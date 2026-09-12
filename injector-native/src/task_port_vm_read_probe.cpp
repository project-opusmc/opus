#include "cooperative_vm_probe_protocol.hpp"

#include <cstdlib>
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
    std::cerr << "[OPUS/MACOS-VM-READ-PROBE] code=" << code
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

}  // namespace

int main(int argc, char* argv[]) {
    ProbeOptions options;
    if (!parse_options(argc, argv, &options)) {
        std::cerr
            << "Usage: opus-task-port-vm-read-probe "
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
    if (!descriptor.allows_vm_read) {
        return emit_failure(
            "CapabilityNotGranted",
            "cooperative descriptor did not grant vm_read"
        );
    }

    mach_port_t target_task = MACH_PORT_NULL;
    const kern_return_t task_result =
        task_for_pid(mach_task_self(), options.pid, &target_task);
    if (task_result != KERN_SUCCESS || target_task == MACH_PORT_NULL) {
        return emit_failure(
            "TaskPortDenied",
            "mach_error=" + std::string(mach_error_string(task_result))
        );
    }
    auto cleanup = [&]() {
        if (target_task != MACH_PORT_NULL) {
            (void)mach_port_deallocate(mach_task_self(), target_task);
            target_task = MACH_PORT_NULL;
        }
    };
    auto fail = [&](const char* code, const std::string& failure_detail) {
        cleanup();
        return emit_failure(code, failure_detail);
    };

    mach_vm_address_t region_address = descriptor.marker_address;
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
    if (region_result != KERN_SUCCESS) {
        return fail(
            "VmRegionQueryFailed",
            "mach_error=" + std::string(mach_error_string(region_result))
        );
    }
    if (
        region_size < sizeof(std::uint64_t) ||
        descriptor.marker_address < region_address ||
        descriptor.marker_address - region_address >
            region_size - sizeof(std::uint64_t) ||
        (region_info.protection & VM_PROT_READ) == 0
    ) {
        return fail(
            "VmRegionUnexpected",
            "published marker was not in a readable cooperative target region"
        );
    }

    std::uint64_t observed_marker = 0;
    mach_vm_size_t actual_size = 0;
    const kern_return_t read_result = mach_vm_read_overwrite(
        target_task,
        descriptor.marker_address,
        sizeof(observed_marker),
        reinterpret_cast<mach_vm_address_t>(&observed_marker),
        &actual_size
    );
    if (
        read_result != KERN_SUCCESS ||
        actual_size != sizeof(observed_marker) ||
        observed_marker != descriptor.marker_value
    ) {
        return fail(
            "VmReadFailed",
            "published cooperative marker did not match expected value"
        );
    }

    if (kill(options.pid, 0) != 0) {
        return fail("TargetExited", "selected cooperative target exited during probe");
    }

    const vm_prot_t protection = region_info.protection;
    cleanup();
    std::cout << "[OPUS/MACOS-VM-READ-PROBE] code=VmReadProbeReady"
              << " pid=" << options.pid
              << " target=cooperative"
              << " marker=matched"
              << " region_query=ready"
              << " region_protection=0x" << std::hex << protection << std::dec
              << " bytes_read=" << actual_size
              << " task_port=acquired_and_released"
              << '\n';
    return 0;
}
