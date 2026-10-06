#include "cooperative_vm_probe_protocol.hpp"

#include <array>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits>
#include <mach/mach.h>
#include <mach/mach_error.h>
#include <mach/mach_vm.h>
#include <mach/vm_region.h>
#include <signal.h>
#include <string>
#include <unistd.h>

namespace {

struct ProbeOptions {
    pid_t pid = -1;
};

int emit_failure(const char* code, const std::string& detail) {
    std::cerr << "[OPUS/MACOS-VM-RW-PROBE] code=" << code
              << " message=" << detail << '\n';
    return 2;
}

bool parse_positive_pid(const char* value, pid_t* pid) {
    if (value == nullptr || pid == nullptr) {
        return false;
    }
    char* end = nullptr;
    const long parsed = std::strtol(value, &end, 10);
    if (
        end == value || *end != '\0' || parsed <= 0 ||
        parsed > std::numeric_limits<pid_t>::max()
    ) {
        return false;
    }
    *pid = static_cast<pid_t>(parsed);
    return true;
}

bool parse_options(int argc, char* argv[], ProbeOptions* options) {
    if (
        options == nullptr || argc != 3 ||
        (std::string(argv[1]) != "--pid" && std::string(argv[1]) != "-p")
    ) {
        return false;
    }
    return parse_positive_pid(argv[2], &options->pid);
}

std::array<std::uint8_t, 32> probe_pattern(
    const opus::cooperative_vm_probe::Descriptor& descriptor
) {
    std::array<std::uint8_t, 32> pattern {};
    for (std::size_t index = 0; index < pattern.size(); ++index) {
        pattern[index] = static_cast<std::uint8_t>(
            descriptor.session_nonce[index]
        );
    }
    return pattern;
}

}  // namespace

int main(int argc, char* argv[]) {
    ProbeOptions options;
    if (!parse_options(argc, argv, &options)) {
        std::cerr
            << "Usage: opus-task-port-vm-rw-probe "
            << "--pid <cooperative-target-pid>\n";
        return 2;
    }

    opus::cooperative_vm_probe::Descriptor descriptor;
    std::string detail;
    if (
        !opus::cooperative_vm_probe::read_descriptor(
            options.pid,
            &descriptor,
            &detail
        )
    ) {
        return emit_failure("CooperativeDescriptorUnavailable", detail);
    }
    if (
        !opus::cooperative_vm_probe::selected_target_matches_descriptor(
            options.pid,
            descriptor,
            &detail
        )
    ) {
        return emit_failure("TargetIdentityMismatch", detail);
    }
    if (!descriptor.allows_vm_rw) {
        return emit_failure(
            "CapabilityNotGranted",
            "cooperative descriptor did not grant vm_rw"
        );
    }

    const long system_page_size = sysconf(_SC_PAGESIZE);
    if (system_page_size <= 0) {
        return emit_failure("PageSizeUnavailable", "cannot determine page size");
    }
    const mach_vm_size_t allocation_size =
        static_cast<mach_vm_size_t>(system_page_size);

    mach_port_t target_task = MACH_PORT_NULL;
    const kern_return_t task_result =
        task_for_pid(mach_task_self(), options.pid, &target_task);
    if (task_result != KERN_SUCCESS || target_task == MACH_PORT_NULL) {
        return emit_failure(
            "TaskPortDenied",
            "mach_error=" + std::string(mach_error_string(task_result))
        );
    }

    mach_vm_address_t remote_address = 0;
    bool allocation_active = false;
    auto release_task = [&]() {
        if (target_task != MACH_PORT_NULL) {
            (void)mach_port_deallocate(mach_task_self(), target_task);
            target_task = MACH_PORT_NULL;
        }
    };
    auto deallocate = [&]() {
        if (!allocation_active) {
            return KERN_SUCCESS;
        }
        const kern_return_t result = mach_vm_deallocate(
            target_task,
            remote_address,
            allocation_size
        );
        if (result == KERN_SUCCESS) {
            allocation_active = false;
            remote_address = 0;
        }
        return result;
    };
    auto fail = [&](const char* code, const std::string& failure_detail) {
        const kern_return_t cleanup_result = deallocate();
        release_task();
        std::string complete_detail = failure_detail;
        if (cleanup_result != KERN_SUCCESS) {
            complete_detail +=
                " cleanup_deallocation_mach_error=" +
                std::string(mach_error_string(cleanup_result));
        }
        return emit_failure(code, complete_detail);
    };

    const kern_return_t allocation_result = mach_vm_allocate(
        target_task,
        &remote_address,
        allocation_size,
        VM_FLAGS_ANYWHERE
    );
    if (allocation_result != KERN_SUCCESS || remote_address == 0U) {
        release_task();
        return emit_failure(
            "VmAllocateFailed",
            "mach_error=" + std::string(mach_error_string(allocation_result))
        );
    }
    allocation_active = true;

    const kern_return_t protection_result = mach_vm_protect(
        target_task,
        remote_address,
        allocation_size,
        false,
        VM_PROT_READ | VM_PROT_WRITE
    );
    if (protection_result != KERN_SUCCESS) {
        return fail(
            "VmProtectionFailed",
            "mach_error=" + std::string(mach_error_string(protection_result))
        );
    }

    mach_vm_address_t region_address = remote_address;
    mach_vm_size_t region_size = 0;
    natural_t nesting_depth = 0;
    vm_region_submap_info_data_64_t region_info {};
    mach_msg_type_number_t region_info_count = VM_REGION_SUBMAP_INFO_COUNT_64;
    const kern_return_t region_result = mach_vm_region_recurse(
        target_task,
        &region_address,
        &region_size,
        &nesting_depth,
        reinterpret_cast<vm_region_recurse_info_t>(&region_info),
        &region_info_count
    );
    if (
        region_result != KERN_SUCCESS ||
        region_size == 0U ||
        remote_address < region_address ||
        remote_address - region_address >= region_size ||
        (region_info.protection & (VM_PROT_READ | VM_PROT_WRITE)) !=
            (VM_PROT_READ | VM_PROT_WRITE)
    ) {
        const std::string result_detail = region_result == KERN_SUCCESS
            ? "allocated region was not read-write"
            : "mach_error=" + std::string(mach_error_string(region_result));
        return fail("VmProtectionQueryFailed", result_detail);
    }

    auto expected = probe_pattern(descriptor);
    const kern_return_t write_result = mach_vm_write(
        target_task,
        remote_address,
        reinterpret_cast<vm_offset_t>(expected.data()),
        static_cast<mach_msg_type_number_t>(expected.size())
    );
    if (write_result != KERN_SUCCESS) {
        return fail(
            "VmWriteFailed",
            "mach_error=" + std::string(mach_error_string(write_result))
        );
    }

    std::array<std::uint8_t, 32> actual {};
    mach_vm_size_t bytes_read = 0;
    const kern_return_t read_result = mach_vm_read_overwrite(
        target_task,
        remote_address,
        actual.size(),
        reinterpret_cast<mach_vm_address_t>(actual.data()),
        &bytes_read
    );
    if (
        read_result != KERN_SUCCESS || bytes_read != actual.size() ||
        std::memcmp(actual.data(), expected.data(), expected.size()) != 0
    ) {
        return fail(
            "VmReadbackFailed",
            "allocated cooperative probe region did not match written pattern"
        );
    }

    if (kill(options.pid, 0) != 0) {
        return fail("TargetExited", "selected cooperative target exited during probe");
    }

    const kern_return_t deallocation_result = deallocate();
    release_task();
    if (deallocation_result != KERN_SUCCESS) {
        return emit_failure(
            "VmDeallocateFailed",
            "mach_error=" + std::string(mach_error_string(deallocation_result))
        );
    }

    std::cout << "[OPUS/MACOS-VM-RW-PROBE] code=VmRwProbeReady"
              << " pid=" << options.pid
              << " target=cooperative"
              << " allocation=success"
              << " rw_protection=success"
              << " protection_query=ready"
              << " write=success"
              << " readback=match"
              << " deallocation=success"
              << " bytes_written=" << expected.size()
              << " bytes_read=" << bytes_read
              << " task_port=acquired_and_released"
              << '\n';
    return 0;
}
