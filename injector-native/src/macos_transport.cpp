#include <dlfcn.h>
#include <libproc.h>
#include <mach/mach.h>
#include <mach/mach_error.h>
#include <mach/mach_vm.h>
#include <mach/machine.h>
#include <mach/vm_region.h>
#include <mach-o/dyld_images.h>
#include <mach/task_info.h>
#if defined(__aarch64__) || defined(__arm64__)
#include <mach/arm/thread_status.h>
#elif defined(__x86_64__)
#include <mach/i386/thread_status.h>
#endif
#include <sys/proc_info.h>
#include <signal.h>
#include <sys/stat.h>
#include <sys/sysctl.h>

#include <array>
#include <cerrno>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits.h>
#include <limits>
#include <string>
#include <thread>
#include <unistd.h>

namespace {

constexpr const char* kPrefix = "[OPUS/MACOS-TRANSPORT]";
constexpr std::size_t kRemoteDataSize = 32U * 1024U;
constexpr std::size_t kRemoteCodeSize = 16U * 1024U;
constexpr std::size_t kMaximumRemoteImageCount = 4096U;
constexpr std::size_t kMaximumRemotePathLength = 4096U;
constexpr std::size_t kMaximumVmRegionProbeQueries = 65536U;
constexpr std::size_t kVmReadProbeByteCount = 16U;
constexpr int kLoadCompletionTimeoutMilliseconds = 5000;
constexpr int kLoadPollIntervalMilliseconds = 10;
constexpr std::uint32_t kNativeExecutionMaximumIterations = 50U;
#if defined(__aarch64__) || defined(__arm64__)
constexpr int kNativeExecutionCompletionTimeoutMilliseconds = 5000;
constexpr int kNativeExecutionPollIntervalMilliseconds = 10;
constexpr std::uint32_t kNativeExecutionMarkerBefore = 0x11223344U;
constexpr std::uint32_t kNativeExecutionMarkerAfter = 0x55667788U;
constexpr std::uint32_t kNativeExecutionWorkerPending = 0U;
constexpr std::uint32_t kNativeExecutionWorkerCompleted = 1U;
constexpr std::uint32_t kNativeExecutionWorkerMarkerMismatch = 2U;
constexpr std::uint32_t kNativeExecutionReadyMinimumIterations = 25U;
#endif
constexpr std::array<std::uint8_t, 32> kVmRwProbePattern = {
    0x4fU, 0x50U, 0x55U, 0x53U, 0x2dU, 0x47U, 0x41U, 0x54U,
    0x45U, 0x34U, 0x2dU, 0x52U, 0x57U, 0x2dU, 0x50U, 0x52U,
    0x4fU, 0x42U, 0x45U, 0x2dU, 0x56U, 0x31U, 0x2dU, 0x30U,
    0x30U, 0x30U, 0x31U, 0x2dU, 0x44U, 0x41U, 0x54U, 0x41U,
};

extern "C" const unsigned char opus_remote_loader_bootstrap_start[];
extern "C" const unsigned char opus_remote_loader_bootstrap_end[];
extern "C" const unsigned char opus_remote_loader_worker_start[];
extern "C" const unsigned char opus_remote_loader_worker_end[];
#if defined(__aarch64__) || defined(__arm64__)
extern "C" const unsigned char opus_native_execution_bootstrap_start[];
extern "C" const unsigned char opus_native_execution_bootstrap_end[];
extern "C" const unsigned char opus_native_execution_worker_start[];
extern "C" const unsigned char opus_native_execution_worker_end[];
#endif

struct RemoteLoaderContext {
    std::uint64_t dlopen_address;
    std::uint64_t runtime_path_address;
    std::uint32_t dlopen_flags;
    std::uint32_t reserved_flags;
    std::uint64_t dlopen_handle;
    std::uint32_t worker_completed;
    std::int32_t pthread_create_result;
    std::uint64_t pthread_create_from_mach_thread_address;
    std::uint64_t worker_entry_address;
    std::uint64_t pthread_storage_address;
};

static_assert(offsetof(RemoteLoaderContext, dlopen_address) == 0U);
static_assert(offsetof(RemoteLoaderContext, runtime_path_address) == 8U);
static_assert(offsetof(RemoteLoaderContext, dlopen_flags) == 16U);
static_assert(offsetof(RemoteLoaderContext, dlopen_handle) == 24U);
static_assert(offsetof(RemoteLoaderContext, worker_completed) == 32U);
static_assert(offsetof(RemoteLoaderContext, pthread_create_result) == 36U);
static_assert(offsetof(RemoteLoaderContext, pthread_create_from_mach_thread_address) == 40U);
static_assert(offsetof(RemoteLoaderContext, worker_entry_address) == 48U);
static_assert(offsetof(RemoteLoaderContext, pthread_storage_address) == 56U);

#if defined(__aarch64__) || defined(__arm64__)
struct NativeExecutionContext {
    std::uint64_t marker_address;
    std::uint32_t marker_before;
    std::uint32_t marker_after;
    std::uint32_t worker_state;
    std::uint32_t reserved_20;
    std::uint64_t reserved_24;
    std::uint32_t reserved_32;
    std::int32_t pthread_create_result;
    std::uint64_t pthread_create_from_mach_thread_address;
    std::uint64_t worker_entry_address;
    std::uint64_t pthread_storage_address;
};

static_assert(sizeof(NativeExecutionContext) == 64U);
static_assert(offsetof(NativeExecutionContext, marker_address) == 0U);
static_assert(offsetof(NativeExecutionContext, marker_before) == 8U);
static_assert(offsetof(NativeExecutionContext, marker_after) == 12U);
static_assert(offsetof(NativeExecutionContext, worker_state) == 16U);
static_assert(offsetof(NativeExecutionContext, pthread_create_result) == 36U);
static_assert(
    offsetof(
        NativeExecutionContext,
        pthread_create_from_mach_thread_address
    ) == 40U
);
static_assert(offsetof(NativeExecutionContext, worker_entry_address) == 48U);
static_assert(offsetof(NativeExecutionContext, pthread_storage_address) == 56U);
#endif

struct NativeExecutionOptions {
    pid_t pid = -1;
    std::uint32_t iterations = 1U;
};

enum class TargetArchitecture {
    kArm64,
    kX86_64,
    kUnsupported,
};

struct TargetTask {
    TargetArchitecture architecture = TargetArchitecture::kUnsupported;
    mach_port_t port = MACH_PORT_NULL;
};

struct ReadableVmRegion {
    mach_vm_address_t address = 0;
    mach_vm_size_t size = 0;
    vm_prot_t protection = VM_PROT_NONE;
    std::size_t query_count = 0;
};

const char* architecture_name(TargetArchitecture architecture) {
    switch (architecture) {
        case TargetArchitecture::kArm64:
            return "arm64";
        case TargetArchitecture::kX86_64:
            return "x86_64";
        case TargetArchitecture::kUnsupported:
            return "unsupported";
    }

    return "unsupported";
}

TargetArchitecture helper_architecture() {
#if defined(__aarch64__) || defined(__arm64__)
    return TargetArchitecture::kArm64;
#elif defined(__x86_64__)
    return TargetArchitecture::kX86_64;
#else
    return TargetArchitecture::kUnsupported;
#endif
}

TargetArchitecture process_architecture(cpu_type_t cpu_type) {
    if (cpu_type == CPU_TYPE_ARM64) {
        return TargetArchitecture::kArm64;
    }
    if (cpu_type == CPU_TYPE_X86_64) {
        return TargetArchitecture::kX86_64;
    }
    return TargetArchitecture::kUnsupported;
}

void emit(const char* code, const std::string& message) {
    std::cout << kPrefix << " code=" << code << " message=" << message << '\n';
}

void emit_error(const char* code, const std::string& message) {
    std::cerr << kPrefix << " code=" << code << " message=" << message << '\n';
}

int emit_structured_failure(const std::string& failure);

std::string mach_result_detail(
    const char* operation,
    kern_return_t result
) {
    const char* error = mach_error_string(result);
    return std::string(operation) + "_return=" +
        std::to_string(static_cast<std::int32_t>(result)) +
        " mach_error=" + (error == nullptr ? "unknown" : error);
}

#if defined(__aarch64__) || defined(__arm64__)
std::string marker_hex(std::uint32_t marker) {
    std::array<char, 11> value {};
    const int length = std::snprintf(
        value.data(),
        value.size(),
        "0x%08x",
        static_cast<unsigned int>(marker)
    );
    if (length != 10) {
        return "0x00000000";
    }
    return value.data();
}
#endif

bool parse_positive_pid(const char* raw_value, pid_t* pid) {
    if (raw_value == nullptr || pid == nullptr || *raw_value == '\0') {
        return false;
    }

    char* end = nullptr;
    errno = 0;
    const long parsed = std::strtol(raw_value, &end, 10);
    if (
        errno != 0 || end == raw_value || *end != '\0' || parsed <= 0 ||
        parsed > std::numeric_limits<pid_t>::max()
    ) {
        return false;
    }

    *pid = static_cast<pid_t>(parsed);
    return true;
}

bool parse_iteration_count(
    const char* raw_value,
    std::uint32_t* iterations
) {
    if (
        raw_value == nullptr || iterations == nullptr ||
        *raw_value == '\0'
    ) {
        return false;
    }

    char* end = nullptr;
    errno = 0;
    const unsigned long parsed = std::strtoul(raw_value, &end, 10);
    if (
        errno != 0 || end == raw_value || *end != '\0' || parsed == 0U ||
        parsed > kNativeExecutionMaximumIterations
    ) {
        return false;
    }

    *iterations = static_cast<std::uint32_t>(parsed);
    return true;
}

bool parse_probe_arguments(int argc, char* argv[], pid_t* pid) {
    if (argc != 4 || std::strcmp(argv[1], "probe") != 0 ||
        std::strcmp(argv[2], "--pid") != 0) {
        return false;
    }
    return parse_positive_pid(argv[3], pid);
}

bool parse_vm_read_probe_arguments(int argc, char* argv[], pid_t* pid) {
    if (
        argc != 4 || std::strcmp(argv[1], "probe-vm-read") != 0 ||
        std::strcmp(argv[2], "--pid") != 0
    ) {
        return false;
    }
    return parse_positive_pid(argv[3], pid);
}

bool parse_vm_rw_probe_arguments(int argc, char* argv[], pid_t* pid) {
    if (
        argc != 4 || std::strcmp(argv[1], "probe-vm-rw") != 0 ||
        std::strcmp(argv[2], "--pid") != 0
    ) {
        return false;
    }
    return parse_positive_pid(argv[3], pid);
}

bool parse_native_execution_arguments(
    int argc,
    char* argv[],
    NativeExecutionOptions* options
) {
    if (
        options == nullptr || (argc != 4 && argc != 6) ||
        std::strcmp(argv[1], "probe-native-execution") != 0 ||
        std::strcmp(argv[2], "--pid") != 0 ||
        !parse_positive_pid(argv[3], &options->pid)
    ) {
        return false;
    }
    if (argc == 4) {
        options->iterations = 1U;
        return true;
    }
    return std::strcmp(argv[4], "--iterations") == 0 &&
        parse_iteration_count(argv[5], &options->iterations);
}

bool parse_load_arguments(
    int argc,
    char* argv[],
    pid_t* pid,
    std::string* runtime_path
) {
    if (
        argc != 6 || pid == nullptr || runtime_path == nullptr ||
        std::strcmp(argv[1], "load") != 0 ||
        std::strcmp(argv[2], "--pid") != 0 ||
        std::strcmp(argv[4], "--runtime") != 0
    ) {
        return false;
    }
    if (!parse_positive_pid(argv[3], pid) || argv[5] == nullptr || *argv[5] == '\0') {
        return false;
    }
    *runtime_path = argv[5];
    return true;
}

bool canonical_runtime_path(
    const std::string& provided_path,
    std::string* canonical_path
) {
    if (
        canonical_path == nullptr || provided_path.empty() ||
        provided_path.front() != '/' || provided_path.size() >= PATH_MAX
    ) {
        return false;
    }

    std::array<char, PATH_MAX> resolved {};
    if (realpath(provided_path.c_str(), resolved.data()) == nullptr) {
        return false;
    }

    struct stat metadata {};
    if (
        stat(resolved.data(), &metadata) != 0 ||
        !S_ISREG(metadata.st_mode)
    ) {
        return false;
    }

    *canonical_path = resolved.data();
    return true;
}

bool acquire_target_task(pid_t pid, TargetTask* target, std::string* error) {
    if (target == nullptr || error == nullptr) {
        return false;
    }

    const TargetArchitecture self_architecture = helper_architecture();
    if (self_architecture == TargetArchitecture::kUnsupported) {
        *error = "HelperArchitectureUnsupported helper_architecture=unsupported";
        return false;
    }

    proc_archinfo target_info {};
    const int target_info_size = proc_pidinfo(
        pid,
        PROC_PIDARCHINFO,
        0,
        &target_info,
        PROC_PIDARCHINFO_SIZE
    );
    if (target_info_size != PROC_PIDARCHINFO_SIZE) {
        *error =
            "TargetArchitectureUnavailable pid=" + std::to_string(pid) +
            " source=proc_pidinfo";
        return false;
    }

    const TargetArchitecture target_architecture =
        process_architecture(target_info.p_cputype);
    if (target_architecture == TargetArchitecture::kUnsupported) {
        *error =
            "TargetArchitectureUnsupported pid=" + std::to_string(pid) +
            " cpu_type=" + std::to_string(target_info.p_cputype);
        return false;
    }
    if (target_architecture != self_architecture) {
        *error =
            "HelperArchitectureMismatch pid=" + std::to_string(pid) +
            " helper_architecture=" + architecture_name(self_architecture) +
            " target_architecture=" + architecture_name(target_architecture);
        return false;
    }

    mach_port_t target_task = MACH_PORT_NULL;
    const kern_return_t task_result =
        task_for_pid(mach_task_self(), pid, &target_task);
    if (task_result != KERN_SUCCESS || target_task == MACH_PORT_NULL) {
        *error =
            "TaskPortDenied pid=" + std::to_string(pid) +
            " target_architecture=" + architecture_name(target_architecture) +
            " " + mach_result_detail("task_for_pid", task_result);
        return false;
    }

    target->architecture = target_architecture;
    target->port = target_task;
    return true;
}

kern_return_t release_target_task_port(TargetTask* target) {
    if (target == nullptr || target->port == MACH_PORT_NULL) {
        return KERN_SUCCESS;
    }

    const kern_return_t result =
        mach_port_deallocate(mach_task_self(), target->port);
    target->port = MACH_PORT_NULL;
    return result;
}

bool release_target_task(TargetTask* target, std::string* error) {
    const kern_return_t result = release_target_task_port(target);
    if (result == KERN_SUCCESS) {
        return true;
    }
    if (error != nullptr) {
        *error = "TaskPortReleaseFailed " +
            mach_result_detail("mach_port_deallocate", result);
    }
    return false;
}

int probe_task_port(pid_t pid) {
    TargetTask target;
    std::string error;
    if (!acquire_target_task(pid, &target, &error)) {
        const std::size_t separator = error.find(' ');
        emit_error(
            error.substr(0, separator).c_str(),
            separator == std::string::npos ? "" : error.substr(separator + 1U)
        );
        return 2;
    }

    if (!release_target_task(&target, &error)) {
        emit_error("TaskPortReleaseFailed", error);
        return 2;
    }

    emit(
        "TaskPortProbeReady",
        "pid=" + std::to_string(pid) +
            " helper_architecture=" + architecture_name(helper_architecture()) +
            " target_architecture=" + architecture_name(target.architecture) +
            " task_port=acquired_and_released"
    );
    return 0;
}

bool select_readable_vm_region(
    mach_port_t target_task,
    ReadableVmRegion* selected_region,
    std::string* failure
) {
    if (selected_region == nullptr || failure == nullptr) {
        return false;
    }

    mach_vm_address_t cursor = 0;
    natural_t nesting_depth = 0;
    for (
        std::size_t query = 1;
        query <= kMaximumVmRegionProbeQueries;
        ++query
    ) {
        mach_vm_size_t region_size = 0;
        vm_region_submap_info_data_64_t region_info {};
        mach_msg_type_number_t region_info_count =
            VM_REGION_SUBMAP_INFO_COUNT_64;
        const kern_return_t region_result = mach_vm_region_recurse(
            target_task,
            &cursor,
            &region_size,
            &nesting_depth,
            reinterpret_cast<vm_region_recurse_info_t>(&region_info),
            &region_info_count
        );
        if (region_result != KERN_SUCCESS) {
            *failure =
                "VmRegionQueryFailed " +
                mach_result_detail("mach_vm_region_recurse", region_result) +
                " queries=" + std::to_string(query);
            return false;
        }
        if (region_info.is_submap != 0U) {
            if (nesting_depth == std::numeric_limits<natural_t>::max()) {
                *failure = "VmRegionQueryFailed nesting_depth=overflow";
                return false;
            }
            ++nesting_depth;
            continue;
        }
        if (
            region_size == 0U ||
            region_size >
                std::numeric_limits<mach_vm_address_t>::max() - cursor
        ) {
            *failure = "VmRegionQueryFailed region_range=invalid";
            return false;
        }
        if (
            region_size >= kVmReadProbeByteCount &&
            (region_info.protection & VM_PROT_READ) != 0 &&
            (region_info.protection & VM_PROT_EXECUTE) == 0
        ) {
            selected_region->address = cursor;
            selected_region->size = region_size;
            selected_region->protection = region_info.protection;
            selected_region->query_count = query;
            return true;
        }
        cursor += region_size;
        nesting_depth = 0;
    }

    *failure =
        "ReadableRegionNotFound queries=" +
        std::to_string(kMaximumVmRegionProbeQueries);
    return false;
}

int probe_vm_read(pid_t pid) {
    TargetTask target;
    std::string failure;
    if (!acquire_target_task(pid, &target, &failure)) {
        return emit_structured_failure(failure);
    }

    ReadableVmRegion region;
    if (!select_readable_vm_region(target.port, &region, &failure)) {
        const kern_return_t release_result = release_target_task_port(&target);
        failure += " " +
            mach_result_detail("mach_port_deallocate", release_result);
        return emit_structured_failure(failure);
    }

    std::array<std::uint8_t, kVmReadProbeByteCount> bytes {};
    mach_vm_size_t actual_size = 0;
    const kern_return_t read_result = mach_vm_read_overwrite(
        target.port,
        region.address,
        bytes.size(),
        reinterpret_cast<mach_vm_address_t>(bytes.data()),
        &actual_size
    );
    const kern_return_t release_result = release_target_task_port(&target);
    if (read_result != KERN_SUCCESS || actual_size != bytes.size()) {
        return emit_structured_failure(
            "VmReadFailed pid=" + std::to_string(pid) +
            " " + mach_result_detail("mach_vm_read_overwrite", read_result) +
            " bytes_requested=" + std::to_string(bytes.size()) +
            " bytes_read=" + std::to_string(actual_size) +
            " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }
    if (release_result != KERN_SUCCESS) {
        return emit_structured_failure(
            "TaskPortReleaseFailed pid=" + std::to_string(pid) +
            " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }

    emit(
        "VmReadProbeReady",
        "pid=" + std::to_string(pid) +
            " helper_architecture=" + architecture_name(helper_architecture()) +
            " target_architecture=" + architecture_name(target.architecture) +
            " target=selected-pid" +
            " vm_region_queries=" + std::to_string(region.query_count) +
            " selected_region_address=" +
                std::to_string(static_cast<std::uint64_t>(region.address)) +
            " selected_region_size=" +
                std::to_string(static_cast<std::uint64_t>(region.size)) +
            " selected_region_protection=" +
                std::to_string(static_cast<std::uint32_t>(region.protection)) +
            " bytes_requested=" + std::to_string(bytes.size()) +
            " bytes_read=" + std::to_string(actual_size) +
            " task_for_pid_return=0" +
            " mach_vm_region_recurse_return=0" +
            " mach_vm_read_overwrite_return=0" +
            " mach_port_deallocate_return=0" +
            " task_port=acquired_and_released"
    );
    return 0;
}

int probe_vm_rw(pid_t pid) {
    const long page_size = sysconf(_SC_PAGESIZE);
    if (page_size <= 0) {
        return emit_structured_failure("PageSizeUnavailable");
    }
    const mach_vm_size_t allocation_size =
        static_cast<mach_vm_size_t>(page_size);

    TargetTask target;
    std::string failure;
    if (!acquire_target_task(pid, &target, &failure)) {
        return emit_structured_failure(failure);
    }

    mach_vm_address_t remote_address = 0;
    bool allocation_active = false;
    auto cleanup_allocation = [&]() {
        if (!allocation_active) {
            return KERN_SUCCESS;
        }
        const kern_return_t result = mach_vm_deallocate(
            target.port,
            remote_address,
            allocation_size
        );
        if (result == KERN_SUCCESS) {
            allocation_active = false;
            remote_address = 0;
        }
        return result;
    };
    auto fail_after_allocation = [&](const char* code, const std::string& detail) {
        const kern_return_t deallocation_result = cleanup_allocation();
        const kern_return_t release_result = release_target_task_port(&target);
        return emit_structured_failure(
            std::string(code) + " pid=" + std::to_string(pid) +
            " " + detail +
            " " +
            mach_result_detail("mach_vm_deallocate", deallocation_result) +
            " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    };

    const kern_return_t allocation_result = mach_vm_allocate(
        target.port,
        &remote_address,
        allocation_size,
        VM_FLAGS_ANYWHERE
    );
    if (allocation_result != KERN_SUCCESS || remote_address == 0U) {
        const kern_return_t release_result = release_target_task_port(&target);
        return emit_structured_failure(
            "VmAllocateFailed pid=" + std::to_string(pid) +
            " " + mach_result_detail("mach_vm_allocate", allocation_result) +
            " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }
    allocation_active = true;

    const kern_return_t protection_result = mach_vm_protect(
        target.port,
        remote_address,
        allocation_size,
        false,
        VM_PROT_READ | VM_PROT_WRITE
    );
    if (protection_result != KERN_SUCCESS) {
        return fail_after_allocation(
            "VmProtectionFailed",
            mach_result_detail("mach_vm_protect", protection_result)
        );
    }

    const kern_return_t write_result = mach_vm_write(
        target.port,
        remote_address,
        reinterpret_cast<vm_offset_t>(
            const_cast<std::uint8_t*>(kVmRwProbePattern.data())
        ),
        static_cast<mach_msg_type_number_t>(kVmRwProbePattern.size())
    );
    if (write_result != KERN_SUCCESS) {
        return fail_after_allocation(
            "VmWriteFailed",
            mach_result_detail("mach_vm_write", write_result)
        );
    }

    std::array<std::uint8_t, kVmRwProbePattern.size()> actual {};
    mach_vm_size_t bytes_read = 0;
    const kern_return_t read_result = mach_vm_read_overwrite(
        target.port,
        remote_address,
        actual.size(),
        reinterpret_cast<mach_vm_address_t>(actual.data()),
        &bytes_read
    );
    if (
        read_result != KERN_SUCCESS ||
        bytes_read != actual.size() ||
        std::memcmp(
            actual.data(),
            kVmRwProbePattern.data(),
            kVmRwProbePattern.size()
        ) != 0
    ) {
        return fail_after_allocation(
            "VmReadbackFailed",
            mach_result_detail("mach_vm_read_overwrite", read_result) +
                " bytes_requested=" + std::to_string(actual.size()) +
                " bytes_read=" + std::to_string(bytes_read)
        );
    }

    const kern_return_t deallocation_result = cleanup_allocation();
    const kern_return_t release_result = release_target_task_port(&target);
    if (deallocation_result != KERN_SUCCESS) {
        return emit_structured_failure(
            "VmDeallocateFailed pid=" + std::to_string(pid) +
            " " +
            mach_result_detail("mach_vm_deallocate", deallocation_result) +
            " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }
    if (release_result != KERN_SUCCESS) {
        return emit_structured_failure(
            "TaskPortReleaseFailed pid=" + std::to_string(pid) +
            " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }

    emit(
        "VmRwProbeReady",
        "pid=" + std::to_string(pid) +
            " helper_architecture=" + architecture_name(helper_architecture()) +
            " target_architecture=" + architecture_name(target.architecture) +
            " target=selected-pid" +
            " allocation_size=" +
                std::to_string(static_cast<std::uint64_t>(allocation_size)) +
            " bytes_written=" +
                std::to_string(kVmRwProbePattern.size()) +
            " bytes_read=" + std::to_string(bytes_read) +
            " readback=exact_match" +
            " task_for_pid_return=0" +
            " mach_vm_allocate_return=0" +
            " mach_vm_protect_return=0" +
            " mach_vm_write_return=0" +
            " mach_vm_read_overwrite_return=0" +
            " mach_vm_deallocate_return=0" +
            " mach_port_deallocate_return=0" +
            " task_port=acquired_and_released"
    );
    return 0;
}

int emit_structured_failure(const std::string& failure) {
    const std::size_t separator = failure.find(' ');
    const std::string code = failure.substr(0, separator);
    const std::string message =
        separator == std::string::npos ? "" : failure.substr(separator + 1U);
    emit_error(code.c_str(), message);
    return 2;
}

bool read_remote_bytes(
    mach_port_t target_task,
    mach_vm_address_t address,
    void* destination,
    mach_vm_size_t size,
    std::string* failure
) {
    mach_vm_size_t actual_size = 0;
    const kern_return_t result = mach_vm_read_overwrite(
        target_task,
        address,
        size,
        reinterpret_cast<mach_vm_address_t>(destination),
        &actual_size
    );
    if (result == KERN_SUCCESS && actual_size == size) {
        return true;
    }
    if (failure != nullptr) {
        *failure =
            "RemoteMemoryReadFailed " +
            mach_result_detail("mach_vm_read_overwrite", result) +
            " bytes_requested=" + std::to_string(size) +
            " bytes_read=" + std::to_string(actual_size);
    }
    return false;
}

template <typename Value>
bool read_remote_value(
    mach_port_t target_task,
    mach_vm_address_t address,
    Value* destination,
    std::string* failure
) {
    return read_remote_bytes(
        target_task,
        address,
        destination,
        sizeof(Value),
        failure
    );
}

bool read_remote_string(
    mach_port_t target_task,
    mach_vm_address_t address,
    std::string* result
) {
    if (address == 0U || result == nullptr) {
        return false;
    }

    std::array<char, kMaximumRemotePathLength> contents {};
    std::string failure;
    if (!read_remote_bytes(
            target_task,
            address,
            contents.data(),
            contents.size(),
            &failure
        )) {
        return false;
    }

    const std::size_t length = strnlen(contents.data(), contents.size());
    if (length == contents.size()) {
        return false;
    }
    *result = std::string(contents.data(), length);
    return true;
}

std::string path_basename(const std::string& path) {
    const std::size_t separator = path.find_last_of('/');
    return separator == std::string::npos ? path : path.substr(separator + 1U);
}

bool resolve_remote_image_base(
    mach_port_t target_task,
    const char* local_image_path,
    mach_vm_address_t* remote_image_base,
    std::string* failure
) {
    if (
        local_image_path == nullptr || remote_image_base == nullptr ||
        failure == nullptr
    ) {
        return false;
    }

    task_dyld_info_data_t dyld_info {};
    mach_msg_type_number_t dyld_info_count = TASK_DYLD_INFO_COUNT;
    const kern_return_t task_info_result = task_info(
        target_task,
        TASK_DYLD_INFO,
        reinterpret_cast<task_info_t>(&dyld_info),
        &dyld_info_count
    );
    if (
        task_info_result != KERN_SUCCESS ||
        dyld_info_count != TASK_DYLD_INFO_COUNT ||
        dyld_info.all_image_info_format != TASK_DYLD_ALL_IMAGE_INFO_64 ||
        dyld_info.all_image_info_addr == 0U
    ) {
        *failure =
            "RemoteDyldInfoUnavailable mach_error=" +
            std::string(mach_error_string(task_info_result));
        return false;
    }

    dyld_all_image_infos images {};
    if (!read_remote_value(
            target_task,
            dyld_info.all_image_info_addr,
            &images,
            failure
        )) {
        return false;
    }
    if (
        images.infoArray == nullptr || images.infoArrayCount == 0U ||
        images.infoArrayCount > kMaximumRemoteImageCount
    ) {
        *failure = "RemoteDyldImageListUnavailable";
        return false;
    }

    const std::string local_path(local_image_path);
    const std::string local_basename = path_basename(local_path);
    const mach_vm_address_t array_address =
        reinterpret_cast<mach_vm_address_t>(images.infoArray);
    for (std::uint32_t index = 0; index < images.infoArrayCount; ++index) {
        const mach_vm_address_t image_address =
            array_address + (sizeof(dyld_image_info) * index);
        dyld_image_info image {};
        std::string image_failure;
        if (!read_remote_value(
                target_task,
                image_address,
                &image,
                &image_failure
            )) {
            continue;
        }

        std::string remote_path;
        if (
            image.imageLoadAddress == nullptr ||
            !read_remote_string(
                target_task,
                reinterpret_cast<mach_vm_address_t>(image.imageFilePath),
                &remote_path
            )
        ) {
            continue;
        }

        if (
            remote_path == local_path ||
            path_basename(remote_path) == local_basename
        ) {
            *remote_image_base =
                reinterpret_cast<mach_vm_address_t>(image.imageLoadAddress);
            return true;
        }
    }

    *failure = "RemoteDyldImageNotFound image=" + local_basename;
    return false;
}

bool resolve_remote_symbol(
    mach_port_t target_task,
    const char* symbol_name,
    mach_vm_address_t* remote_symbol,
    std::string* failure
) {
    if (
        symbol_name == nullptr || remote_symbol == nullptr || failure == nullptr
    ) {
        return false;
    }

    void* local_symbol = dlsym(RTLD_DEFAULT, symbol_name);
    Dl_info local_info {};
    if (
        local_symbol == nullptr ||
        dladdr(local_symbol, &local_info) == 0 ||
        local_info.dli_fname == nullptr ||
        local_info.dli_fbase == nullptr
    ) {
        *failure = "LocalSymbolUnavailable symbol=" + std::string(symbol_name);
        return false;
    }

    const auto local_address =
        reinterpret_cast<std::uintptr_t>(local_symbol);
    const auto local_image_base =
        reinterpret_cast<std::uintptr_t>(local_info.dli_fbase);
    if (local_address < local_image_base) {
        *failure = "LocalSymbolAddressInvalid symbol=" + std::string(symbol_name);
        return false;
    }

    mach_vm_address_t remote_image_base = 0;
    if (!resolve_remote_image_base(
            target_task,
            local_info.dli_fname,
            &remote_image_base,
            failure
        )) {
        return false;
    }

    *remote_symbol =
        remote_image_base + static_cast<mach_vm_address_t>(
            local_address - local_image_base
        );
    return true;
}

bool write_remote_bytes(
    mach_port_t target_task,
    mach_vm_address_t address,
    const void* source,
    mach_msg_type_number_t size,
    std::string* failure
) {
    const kern_return_t result = mach_vm_write(
        target_task,
        address,
        reinterpret_cast<vm_offset_t>(const_cast<void*>(source)),
        size
    );
    if (result == KERN_SUCCESS) {
        return true;
    }
    if (failure != nullptr) {
        *failure =
            "RemoteMemoryWriteFailed " +
            mach_result_detail("mach_vm_write", result);
    }
    return false;
}

bool allocate_remote_memory(
    mach_port_t target_task,
    mach_vm_size_t size,
    mach_vm_address_t* address,
    std::string* failure
) {
    if (address == nullptr) {
        return false;
    }
    *address = 0;
    const kern_return_t result = mach_vm_allocate(
        target_task,
        address,
        size,
        VM_FLAGS_ANYWHERE
    );
    if (result == KERN_SUCCESS) {
        return true;
    }
    if (failure != nullptr) {
        *failure =
            "RemoteMemoryAllocateFailed " +
            mach_result_detail("mach_vm_allocate", result);
    }
    return false;
}

void release_remote_memory(
    mach_port_t target_task,
    mach_vm_address_t address,
    mach_vm_size_t size
) {
    if (address != 0U) {
        (void)mach_vm_deallocate(target_task, address, size);
    }
}

#if defined(__x86_64__)
bool helper_runs_under_rosetta() {
    int translated = 0;
    std::size_t size = sizeof(translated);
    return sysctlbyname(
        "sysctl.proc_translated",
        &translated,
        &size,
        nullptr,
        0
    ) == 0 && translated == 1;
}
#endif

bool start_remote_loader_thread(
    mach_port_t target_task,
    mach_vm_address_t code_address,
    mach_vm_address_t context_address,
    mach_vm_address_t data_address,
    thread_act_t* loader_thread,
    std::string* failure
) {
    if (loader_thread == nullptr || failure == nullptr) {
        return false;
    }
    *loader_thread = MACH_PORT_NULL;

#if defined(__aarch64__) || defined(__arm64__)
    arm_thread_state64_t state {};
    state.__pc = code_address;
    state.__sp = data_address + kRemoteDataSize;
    state.__x[0] = context_address;
    const kern_return_t result = thread_create_running(
        target_task,
        ARM_THREAD_STATE64,
        reinterpret_cast<thread_state_t>(&state),
        ARM_THREAD_STATE64_COUNT,
        loader_thread
    );
#elif defined(__x86_64__)
    x86_thread_state64_t state {};
    state.__rip = code_address;
    state.__rsp = data_address + kRemoteDataSize - sizeof(std::uint64_t);
    state.__rdi = context_address;
    const kern_return_t result = thread_create_running(
        target_task,
        x86_THREAD_STATE64,
        reinterpret_cast<thread_state_t>(&state),
        x86_THREAD_STATE64_COUNT,
        loader_thread
    );
#else
    const kern_return_t result = KERN_NOT_SUPPORTED;
#endif

    if (result == KERN_SUCCESS && *loader_thread != MACH_PORT_NULL) {
        return true;
    }
#if defined(__x86_64__)
    if (result == KERN_INVALID_ARGUMENT && helper_runs_under_rosetta()) {
        *failure =
            "RosettaRemoteThreadUnavailable mach_error=" +
            std::string(mach_error_string(result));
        return false;
    }
#endif
    *failure =
        "RemoteThreadCreateFailed mach_error=" +
        std::string(mach_error_string(result));
    return false;
}

bool terminate_loader_thread(thread_act_t loader_thread, std::string* failure) {
    if (loader_thread == MACH_PORT_NULL) {
        return true;
    }
    const kern_return_t result = thread_terminate(loader_thread);
    if (result == KERN_SUCCESS) {
        return true;
    }
    if (failure != nullptr) {
        *failure =
            "RemoteThreadTerminateFailed mach_error=" +
            std::string(mach_error_string(result));
    }
    return false;
}

#if defined(__aarch64__) || defined(__arm64__)
struct NativeExecutionResources {
    mach_vm_address_t data_address = 0;
    mach_vm_address_t code_address = 0;
    thread_act_t bootstrap_thread = MACH_PORT_NULL;
};

struct NativeExecutionCleanup {
    kern_return_t thread_terminate_result = KERN_SUCCESS;
    kern_return_t thread_port_release_result = KERN_SUCCESS;
    kern_return_t code_deallocate_result = KERN_SUCCESS;
    kern_return_t data_deallocate_result = KERN_SUCCESS;
    bool thread_port_released = true;
    bool complete = true;
};

struct NativeExecutionIterationResult {
    std::uint32_t marker_before = kNativeExecutionMarkerBefore;
    std::uint32_t marker_after = 0;
    kern_return_t thread_terminate_result = KERN_SUCCESS;
    kern_return_t thread_port_release_result = KERN_SUCCESS;
    kern_return_t code_deallocate_result = KERN_SUCCESS;
    kern_return_t data_deallocate_result = KERN_SUCCESS;
    bool thread_port_released = true;
    bool execution_observed = false;
    bool cleanup_complete = false;
    bool target_alive = false;
};

const char* boolean_value(bool value) {
    return value ? "true" : "false";
}

std::string native_execution_cleanup_detail(
    const NativeExecutionCleanup& cleanup
) {
    return mach_result_detail(
               "thread_terminate",
               cleanup.thread_terminate_result
           ) +
        " " +
        mach_result_detail(
            "bootstrap_thread_port_deallocate",
            cleanup.thread_port_release_result
        ) +
        " " +
        mach_result_detail(
            "code_mach_vm_deallocate",
            cleanup.code_deallocate_result
        ) +
        " " +
        mach_result_detail(
            "data_mach_vm_deallocate",
            cleanup.data_deallocate_result
        ) +
        " bootstrap_thread_port_released=" +
            boolean_value(cleanup.thread_port_released) +
        " cleanup=" + boolean_value(cleanup.complete);
}

NativeExecutionCleanup cleanup_native_execution_resources(
    mach_port_t target_task,
    NativeExecutionResources* resources,
    bool may_deallocate_target_memory
) {
    NativeExecutionCleanup cleanup;
    if (resources == nullptr) {
        cleanup.complete = false;
        return cleanup;
    }

    if (resources->bootstrap_thread != MACH_PORT_NULL) {
        cleanup.thread_terminate_result =
            thread_terminate(resources->bootstrap_thread);
        cleanup.thread_port_release_result = mach_port_deallocate(
            mach_task_self(),
            resources->bootstrap_thread
        );
        resources->bootstrap_thread = MACH_PORT_NULL;
        if (cleanup.thread_terminate_result != KERN_SUCCESS) {
            cleanup.complete = false;
            may_deallocate_target_memory = false;
        }
        if (cleanup.thread_port_release_result != KERN_SUCCESS) {
            cleanup.thread_port_released =
                cleanup.thread_terminate_result == KERN_SUCCESS &&
                cleanup.thread_port_release_result == KERN_INVALID_NAME;
            if (!cleanup.thread_port_released) {
                cleanup.complete = false;
            }
        }
    }

    if (!may_deallocate_target_memory) {
        if (
            resources->code_address != 0U ||
            resources->data_address != 0U
        ) {
            cleanup.complete = false;
        }
        return cleanup;
    }

    if (resources->code_address != 0U) {
        cleanup.code_deallocate_result = mach_vm_deallocate(
            target_task,
            resources->code_address,
            kRemoteCodeSize
        );
        if (cleanup.code_deallocate_result == KERN_SUCCESS) {
            resources->code_address = 0;
        } else {
            cleanup.complete = false;
        }
    }
    if (resources->data_address != 0U) {
        cleanup.data_deallocate_result = mach_vm_deallocate(
            target_task,
            resources->data_address,
            kRemoteDataSize
        );
        if (cleanup.data_deallocate_result == KERN_SUCCESS) {
            resources->data_address = 0;
        } else {
            cleanup.complete = false;
        }
    }
    return cleanup;
}

bool target_is_alive(pid_t pid) {
    if (kill(pid, 0) == 0) {
        return true;
    }
    return errno == EPERM;
}

bool execute_native_execution_iteration(
    TargetTask* target,
    pid_t pid,
    std::uint32_t iteration,
    std::uint32_t total_iterations,
    mach_vm_address_t remote_pthread_create_from_mach_thread,
    const unsigned char* code_start,
    std::size_t code_size,
    std::size_t worker_offset,
    NativeExecutionIterationResult* result,
    std::string* failure
) {
    if (
        target == nullptr || target->port == MACH_PORT_NULL ||
        code_start == nullptr || result == nullptr || failure == nullptr ||
        code_size == 0U || code_size > kRemoteCodeSize ||
        worker_offset >= code_size
    ) {
        return false;
    }

    *result = NativeExecutionIterationResult {};
    const std::string iteration_detail =
        " iteration=" + std::to_string(iteration) + "/" +
        std::to_string(total_iterations);
    NativeExecutionResources resources;
    std::string operation_failure;

    if (
        !allocate_remote_memory(
            target->port,
            kRemoteDataSize,
            &resources.data_address,
            &operation_failure
        ) ||
        !allocate_remote_memory(
            target->port,
            kRemoteCodeSize,
            &resources.code_address,
            &operation_failure
        )
    ) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionAllocationFailed pid=" + std::to_string(pid) +
            iteration_detail + " " + operation_failure + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    const mach_vm_address_t remote_marker =
        resources.data_address + sizeof(NativeExecutionContext);
    const std::size_t pthread_storage_offset =
        (sizeof(NativeExecutionContext) + sizeof(std::uint32_t) +
            alignof(std::uint64_t) - 1U) &
        ~(alignof(std::uint64_t) - 1U);
    const std::size_t required_data_size =
        pthread_storage_offset + sizeof(std::uint64_t);
    if (required_data_size > kRemoteDataSize) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionDataLayoutInvalid pid=" +
            std::to_string(pid) + iteration_detail + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    NativeExecutionContext context {};
    context.marker_address = remote_marker;
    context.marker_before = kNativeExecutionMarkerBefore;
    context.marker_after = kNativeExecutionMarkerAfter;
    context.worker_state = kNativeExecutionWorkerPending;
    context.pthread_create_from_mach_thread_address =
        remote_pthread_create_from_mach_thread;
    context.worker_entry_address =
        resources.code_address + static_cast<mach_vm_address_t>(worker_offset);
    context.pthread_storage_address =
        resources.data_address +
        static_cast<mach_vm_address_t>(pthread_storage_offset);
    const std::uint32_t marker_before = kNativeExecutionMarkerBefore;

    if (
        !write_remote_bytes(
            target->port,
            resources.data_address,
            &context,
            sizeof(context),
            &operation_failure
        ) ||
        !write_remote_bytes(
            target->port,
            remote_marker,
            &marker_before,
            sizeof(marker_before),
            &operation_failure
        ) ||
        !write_remote_bytes(
            target->port,
            resources.code_address,
            code_start,
            static_cast<mach_msg_type_number_t>(code_size),
            &operation_failure
        )
    ) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionWriteFailed pid=" + std::to_string(pid) +
            iteration_detail + " " + operation_failure + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    const kern_return_t protect_result = mach_vm_protect(
        target->port,
        resources.code_address,
        kRemoteCodeSize,
        false,
        VM_PROT_READ | VM_PROT_EXECUTE
    );
    if (protect_result != KERN_SUCCESS) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionCodeProtectDenied pid=" +
            std::to_string(pid) + iteration_detail + " " +
            mach_result_detail("mach_vm_protect", protect_result) + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    if (!start_remote_loader_thread(
            target->port,
            resources.code_address,
            resources.data_address,
            resources.data_address,
            &resources.bootstrap_thread,
            &operation_failure
        )) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionThreadStartFailed pid=" +
            std::to_string(pid) + iteration_detail + " " +
            operation_failure + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    NativeExecutionContext observed_context {};
    bool worker_completed = false;
    bool worker_marker_mismatch = false;
    bool worker_creation_failed = false;
    for (
        int elapsed = 0;
        elapsed < kNativeExecutionCompletionTimeoutMilliseconds;
        elapsed += kNativeExecutionPollIntervalMilliseconds
    ) {
        if (!read_remote_value(
                target->port,
                resources.data_address,
                &observed_context,
                &operation_failure
            )) {
            const NativeExecutionCleanup cleanup =
                cleanup_native_execution_resources(
                    target->port,
                    &resources,
                    false
                );
            *failure =
                "NativeExecutionContextReadFailed pid=" +
                std::to_string(pid) + iteration_detail + " " +
                operation_failure + " " +
                native_execution_cleanup_detail(cleanup);
            return false;
        }
        if (observed_context.pthread_create_result != 0) {
            worker_creation_failed = true;
            break;
        }
        if (
            observed_context.worker_state ==
            kNativeExecutionWorkerCompleted
        ) {
            worker_completed = true;
            break;
        }
        if (
            observed_context.worker_state ==
            kNativeExecutionWorkerMarkerMismatch
        ) {
            worker_marker_mismatch = true;
            break;
        }
        std::this_thread::sleep_for(
            std::chrono::milliseconds(
                kNativeExecutionPollIntervalMilliseconds
            )
        );
    }

    if (worker_creation_failed) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionPthreadCreateFailed pid=" +
            std::to_string(pid) + iteration_detail +
            " pthread_create_result=" +
            std::to_string(observed_context.pthread_create_result) + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }
    if (worker_marker_mismatch) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionMarkerPreconditionFailed pid=" +
            std::to_string(pid) + iteration_detail + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }
    if (!worker_completed) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                false
            );
        *failure =
            "NativeExecutionTimedOut pid=" + std::to_string(pid) +
            iteration_detail + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    // The worker publishes its completed state immediately before returning
    // through the pthread entrypoint. Give that return a bounded settle time
    // before its code page is released.
    std::this_thread::sleep_for(
        std::chrono::milliseconds(kNativeExecutionPollIntervalMilliseconds)
    );

    std::uint32_t marker_after = 0;
    if (!read_remote_value(
            target->port,
            remote_marker,
            &marker_after,
            &operation_failure
        )) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionMarkerReadFailed pid=" +
            std::to_string(pid) + iteration_detail + " " +
            operation_failure + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }
    result->marker_after = marker_after;
    if (marker_after != kNativeExecutionMarkerAfter) {
        const NativeExecutionCleanup cleanup =
            cleanup_native_execution_resources(
                target->port,
                &resources,
                true
            );
        *failure =
            "NativeExecutionMarkerMismatch pid=" + std::to_string(pid) +
            iteration_detail + " marker_before=" +
            marker_hex(kNativeExecutionMarkerBefore) +
            " expected_after=" + marker_hex(kNativeExecutionMarkerAfter) +
            " marker_after=" + marker_hex(marker_after) + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    result->execution_observed = true;
    const NativeExecutionCleanup cleanup =
        cleanup_native_execution_resources(
            target->port,
            &resources,
            true
        );
    result->cleanup_complete = cleanup.complete;
    result->thread_terminate_result = cleanup.thread_terminate_result;
    result->thread_port_release_result =
        cleanup.thread_port_release_result;
    result->code_deallocate_result = cleanup.code_deallocate_result;
    result->data_deallocate_result = cleanup.data_deallocate_result;
    result->thread_port_released = cleanup.thread_port_released;
    if (!cleanup.complete) {
        *failure =
            "NativeExecutionCleanupFailed pid=" + std::to_string(pid) +
            iteration_detail + " " +
            native_execution_cleanup_detail(cleanup);
        return false;
    }

    result->target_alive = target_is_alive(pid);
    if (!result->target_alive) {
        *failure =
            "NativeExecutionTargetExited pid=" + std::to_string(pid) +
            iteration_detail;
        return false;
    }
    return true;
}
#endif

int probe_native_execution(
    pid_t pid,
    std::uint32_t iterations
) {
#if !defined(__aarch64__) && !defined(__arm64__)
    (void)pid;
    (void)iterations;
    return emit_structured_failure(
        "NativeExecutionArchitectureUnsupported required=arm64"
    );
#else
    TargetTask target;
    std::string failure;
    if (!acquire_target_task(pid, &target, &failure)) {
        return emit_structured_failure(failure);
    }
    if (target.architecture != TargetArchitecture::kArm64) {
        const kern_return_t release_result = release_target_task_port(&target);
        return emit_structured_failure(
            "NativeExecutionArchitectureUnsupported pid=" +
            std::to_string(pid) + " target_architecture=" +
            architecture_name(target.architecture) + " required=arm64 " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }

    mach_vm_address_t remote_pthread_create_from_mach_thread = 0;
    if (!resolve_remote_symbol(
            target.port,
            "pthread_create_from_mach_thread",
            &remote_pthread_create_from_mach_thread,
            &failure
        )) {
        const kern_return_t release_result = release_target_task_port(&target);
        return emit_structured_failure(
            "NativeExecutionPthreadSymbolUnavailable pid=" +
            std::to_string(pid) + " " + failure + " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }

    const auto bootstrap_start =
        reinterpret_cast<std::uintptr_t>(
            opus_native_execution_bootstrap_start
        );
    const auto bootstrap_end =
        reinterpret_cast<std::uintptr_t>(
            opus_native_execution_bootstrap_end
        );
    const auto worker_start =
        reinterpret_cast<std::uintptr_t>(opus_native_execution_worker_start);
    const auto worker_end =
        reinterpret_cast<std::uintptr_t>(opus_native_execution_worker_end);
    if (
        bootstrap_end <= bootstrap_start ||
        worker_start < bootstrap_end ||
        worker_end <= worker_start ||
        worker_end - bootstrap_start > kRemoteCodeSize
    ) {
        const kern_return_t release_result = release_target_task_port(&target);
        return emit_structured_failure(
            "NativeExecutionBootstrapInvalid pid=" + std::to_string(pid) +
            " " + mach_result_detail("mach_port_deallocate", release_result)
        );
    }

    const auto code_size =
        static_cast<std::size_t>(worker_end - bootstrap_start);
    const auto worker_offset =
        static_cast<std::size_t>(worker_start - bootstrap_start);
    NativeExecutionIterationResult last_iteration;
    for (
        std::uint32_t iteration = 1U;
        iteration <= iterations;
        ++iteration
    ) {
        if (!execute_native_execution_iteration(
                &target,
                pid,
                iteration,
                iterations,
                remote_pthread_create_from_mach_thread,
                opus_native_execution_bootstrap_start,
                code_size,
                worker_offset,
                &last_iteration,
                &failure
            )) {
            const kern_return_t release_result =
                release_target_task_port(&target);
            return emit_structured_failure(
                failure + " " +
                mach_result_detail("mach_port_deallocate", release_result)
            );
        }
    }

    const kern_return_t release_result = release_target_task_port(&target);
    if (release_result != KERN_SUCCESS) {
        return emit_structured_failure(
            "TaskPortReleaseFailed pid=" + std::to_string(pid) + " " +
            mach_result_detail("mach_port_deallocate", release_result)
        );
    }

    const bool ready =
        iterations >= kNativeExecutionReadyMinimumIterations;
    emit(
        ready ? "NativeExecutionReady" : "NativeExecutionObserved",
        "gate=5 state=" +
            std::string(
                ready ? "NativeExecutionReady" : "ExecutionObserved"
            ) +
            " target_pid=" + std::to_string(pid) +
            " architecture=arm64" +
            " marker_before=" +
                marker_hex(last_iteration.marker_before) +
            " expected_after=" + marker_hex(kNativeExecutionMarkerAfter) +
            " marker_after=" + marker_hex(last_iteration.marker_after) +
            " execution_observed=" +
                boolean_value(last_iteration.execution_observed) +
            " cleanup=" +
                boolean_value(last_iteration.cleanup_complete) +
            " target_alive=" +
                boolean_value(last_iteration.target_alive) +
            " iterations_completed=" + std::to_string(iterations) +
            " iterations_requested=" + std::to_string(iterations) +
            " iteration=" + std::to_string(iterations) + "/" +
                std::to_string(iterations) +
            " task_for_pid_return=0" +
            " mach_vm_protect_return=0" +
            " thread_create_running_return=0" +
            " thread_terminate_return=" +
                std::to_string(
                    static_cast<std::int32_t>(
                        last_iteration.thread_terminate_result
                    )
                ) +
            " bootstrap_thread_port_deallocate_return=" +
                std::to_string(
                    static_cast<std::int32_t>(
                        last_iteration.thread_port_release_result
                    )
                ) +
            " bootstrap_thread_port_released=" +
                boolean_value(last_iteration.thread_port_released) +
            " code_mach_vm_deallocate_return=" +
                std::to_string(
                    static_cast<std::int32_t>(
                        last_iteration.code_deallocate_result
                    )
                ) +
            " data_mach_vm_deallocate_return=" +
                std::to_string(
                    static_cast<std::int32_t>(
                        last_iteration.data_deallocate_result
                    )
                ) +
            " mach_port_deallocate_return=0"
    );
    return 0;
#endif
}

int load_remote_runtime(pid_t pid, const std::string& provided_runtime_path) {
    std::string runtime_path;
    if (!canonical_runtime_path(provided_runtime_path, &runtime_path)) {
        return emit_structured_failure("RuntimePathInvalid");
    }

    TargetTask target;
    std::string failure;
    if (!acquire_target_task(pid, &target, &failure)) {
        return emit_structured_failure(failure);
    }

    mach_vm_address_t remote_dlopen = 0;
    if (!resolve_remote_symbol(target.port, "dlopen", &remote_dlopen, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    mach_vm_address_t remote_pthread_create_from_mach_thread = 0;
    if (!resolve_remote_symbol(
            target.port,
            "pthread_create_from_mach_thread",
            &remote_pthread_create_from_mach_thread,
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    const auto bootstrap_start =
        reinterpret_cast<std::uintptr_t>(opus_remote_loader_bootstrap_start);
    const auto bootstrap_end =
        reinterpret_cast<std::uintptr_t>(opus_remote_loader_bootstrap_end);
    const auto worker_start =
        reinterpret_cast<std::uintptr_t>(opus_remote_loader_worker_start);
    const auto worker_end =
        reinterpret_cast<std::uintptr_t>(opus_remote_loader_worker_end);
    if (
        bootstrap_end <= bootstrap_start ||
        worker_start < bootstrap_start ||
        worker_start >= worker_end ||
        worker_end < bootstrap_end ||
        worker_end - bootstrap_start > kRemoteCodeSize
    ) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure("RemoteBootstrapInvalid");
    }

    mach_vm_address_t remote_data = 0;
    mach_vm_address_t remote_code = 0;
    if (!allocate_remote_memory(target.port, kRemoteDataSize, &remote_data, &failure) ||
        !allocate_remote_memory(target.port, kRemoteCodeSize, &remote_code, &failure)) {
        release_remote_memory(target.port, remote_code, kRemoteCodeSize);
        release_remote_memory(target.port, remote_data, kRemoteDataSize);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    const mach_vm_address_t remote_runtime_path =
        remote_data + sizeof(RemoteLoaderContext);
    const std::size_t runtime_path_end =
        sizeof(RemoteLoaderContext) + runtime_path.size() + 1U;
    const std::size_t pthread_storage_offset =
        (runtime_path_end + alignof(std::uint64_t) - 1U) &
        ~(alignof(std::uint64_t) - 1U);
    const std::size_t required_data_size =
        pthread_storage_offset + sizeof(std::uint64_t);
    if (required_data_size > kRemoteDataSize) {
        release_remote_memory(target.port, remote_code, kRemoteCodeSize);
        release_remote_memory(target.port, remote_data, kRemoteDataSize);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure("RuntimePathTooLong");
    }

    RemoteLoaderContext context {};
    context.dlopen_address = remote_dlopen;
    context.runtime_path_address = remote_runtime_path;
    context.dlopen_flags = static_cast<std::uint32_t>(RTLD_NOW | RTLD_LOCAL);
    context.pthread_create_from_mach_thread_address =
        remote_pthread_create_from_mach_thread;
    context.worker_entry_address =
        remote_code + static_cast<mach_vm_address_t>(worker_start - bootstrap_start);
    context.pthread_storage_address =
        remote_data + static_cast<mach_vm_address_t>(pthread_storage_offset);

    if (!write_remote_bytes(
            target.port,
            remote_data,
            &context,
            sizeof(context),
            &failure
        ) ||
        !write_remote_bytes(
            target.port,
            remote_runtime_path,
            runtime_path.c_str(),
            static_cast<mach_msg_type_number_t>(runtime_path.size() + 1U),
            &failure
        ) ||
        !write_remote_bytes(
            target.port,
            remote_code,
            opus_remote_loader_bootstrap_start,
            static_cast<mach_msg_type_number_t>(worker_end - bootstrap_start),
            &failure
        )) {
        release_remote_memory(target.port, remote_code, kRemoteCodeSize);
        release_remote_memory(target.port, remote_data, kRemoteDataSize);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    const kern_return_t protect_result = mach_vm_protect(
        target.port,
        remote_code,
        kRemoteCodeSize,
        false,
        VM_PROT_READ | VM_PROT_EXECUTE
    );
    if (protect_result != KERN_SUCCESS) {
        release_remote_memory(target.port, remote_code, kRemoteCodeSize);
        release_remote_memory(target.port, remote_data, kRemoteDataSize);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "RemoteCodeProtectDenied mach_error=" +
            std::string(mach_error_string(protect_result))
        );
    }

    thread_act_t loader_thread = MACH_PORT_NULL;
    if (!start_remote_loader_thread(
            target.port,
            remote_code,
            remote_data,
            remote_data,
            &loader_thread,
            &failure
        )) {
        release_remote_memory(target.port, remote_code, kRemoteCodeSize);
        release_remote_memory(target.port, remote_data, kRemoteDataSize);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    RemoteLoaderContext completed_context {};
    bool worker_completed = false;
    bool pthread_creation_failed = false;
    for (
        int elapsed = 0;
        elapsed < kLoadCompletionTimeoutMilliseconds;
        elapsed += kLoadPollIntervalMilliseconds
    ) {
        if (!read_remote_value(
                target.port,
                remote_data,
                &completed_context,
                &failure
            )) {
            (void)mach_port_deallocate(mach_task_self(), loader_thread);
            (void)release_target_task(&target, nullptr);
            return emit_structured_failure(failure);
        }
        if (completed_context.pthread_create_result != 0) {
            pthread_creation_failed = true;
            break;
        }
        if (completed_context.worker_completed == 1U) {
            worker_completed = true;
            break;
        }
        std::this_thread::sleep_for(
            std::chrono::milliseconds(kLoadPollIntervalMilliseconds)
        );
    }

    if (pthread_creation_failed) {
        if (!terminate_loader_thread(loader_thread, &failure)) {
            (void)mach_port_deallocate(mach_task_self(), loader_thread);
            (void)release_target_task(&target, nullptr);
            return emit_structured_failure(failure);
        }
        (void)mach_port_deallocate(mach_task_self(), loader_thread);
        release_remote_memory(target.port, remote_code, kRemoteCodeSize);
        release_remote_memory(target.port, remote_data, kRemoteDataSize);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "RemotePthreadCreateFailed pid=" + std::to_string(pid) +
            " error=" + std::to_string(completed_context.pthread_create_result)
        );
    }

    if (!worker_completed) {
        (void)mach_port_deallocate(mach_task_self(), loader_thread);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "RemoteLoadTimedOut pid=" + std::to_string(pid) +
            " recovery=restart-target"
        );
    }

    if (!terminate_loader_thread(loader_thread, &failure)) {
        (void)mach_port_deallocate(mach_task_self(), loader_thread);
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    (void)mach_port_deallocate(mach_task_self(), loader_thread);

    release_remote_memory(target.port, remote_code, kRemoteCodeSize);
    release_remote_memory(target.port, remote_data, kRemoteDataSize);
    const bool released = release_target_task(&target, &failure);
    if (!released) {
        return emit_structured_failure(failure);
    }

    if (completed_context.dlopen_handle == 0U) {
        return emit_structured_failure(
            "RemoteDlopenReturnedNull pid=" + std::to_string(pid)
        );
    }

    emit(
        "RemoteDlopenReady",
        "pid=" + std::to_string(pid) +
            " target_architecture=" + architecture_name(target.architecture) +
            " loader=system-dlopen bootstrap=removed"
    );
    return 0;
}

void print_usage() {
    std::cout
        << "Usage:\n"
        << "  opus-macos-transport probe --pid <current-user-pid>\n"
        << "  opus-macos-transport probe-vm-read --pid <current-user-pid>\n"
        << "  opus-macos-transport probe-vm-rw --pid <current-user-pid>\n"
        << "  opus-macos-transport probe-native-execution --pid <current-user-pid> [--iterations <1-50>]\n"
        << "  opus-macos-transport load --pid <current-user-pid> --runtime <absolute-dylib-path>\n";
}

}  // namespace

int main(int argc, char* argv[]) {
    pid_t pid = 0;
    if (parse_probe_arguments(argc, argv, &pid)) {
        return probe_task_port(pid);
    }
    if (parse_vm_read_probe_arguments(argc, argv, &pid)) {
        return probe_vm_read(pid);
    }
    if (parse_vm_rw_probe_arguments(argc, argv, &pid)) {
        return probe_vm_rw(pid);
    }
    NativeExecutionOptions native_execution_options;
    if (
        parse_native_execution_arguments(
            argc,
            argv,
            &native_execution_options
        )
    ) {
        return probe_native_execution(
            native_execution_options.pid,
            native_execution_options.iterations
        );
    }

    std::string runtime_path;
    if (parse_load_arguments(argc, argv, &pid, &runtime_path)) {
        return load_remote_runtime(pid, runtime_path);
    }

    print_usage();
    return 2;
}
