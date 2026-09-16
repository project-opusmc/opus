#include "opus_bootstrap_protocol.hpp"

#include <CommonCrypto/CommonDigest.h>
#include <dlfcn.h>
#include <fcntl.h>
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
#include <map>
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
constexpr std::size_t kMaximumBootstrapSessionBytes = 4096U;
constexpr int kLoadCompletionTimeoutMilliseconds = 5000;
constexpr int kLoadPollIntervalMilliseconds = 10;
constexpr std::uint32_t kBootstrapSessionSchemaVersion = 1U;
constexpr const char* kBootstrapSessionDirectoryPrefix =
    "/tmp/opus-macos-bootstrap-session-";
constexpr const char* kBootstrapSessionSuffix = ".session";
constexpr const char* kOwnedBootstrapFixtureBasename =
    "opus-task-port-probe-target";
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

struct RemoteCallContext {
    std::uint64_t function_address;
    std::uint64_t argument0;
    std::uint64_t argument1;
    std::uint64_t return_value;
    std::uint32_t worker_completed;
    std::int32_t pthread_create_result;
    std::uint64_t pthread_create_from_mach_thread_address;
    std::uint64_t worker_entry_address;
    std::uint64_t pthread_storage_address;
};

static_assert(sizeof(RemoteCallContext) == 64U);
static_assert(offsetof(RemoteCallContext, function_address) == 0U);
static_assert(offsetof(RemoteCallContext, argument0) == 8U);
static_assert(offsetof(RemoteCallContext, argument1) == 16U);
static_assert(offsetof(RemoteCallContext, return_value) == 24U);
static_assert(offsetof(RemoteCallContext, worker_completed) == 32U);
static_assert(offsetof(RemoteCallContext, pthread_create_result) == 36U);
static_assert(
    offsetof(
        RemoteCallContext,
        pthread_create_from_mach_thread_address
    ) == 40U
);
static_assert(offsetof(RemoteCallContext, worker_entry_address) == 48U);
static_assert(offsetof(RemoteCallContext, pthread_storage_address) == 56U);

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

struct BootstrapLoadOptions {
    pid_t pid = -1;
    std::string bootstrap_path;
    std::string run_id;
};

struct BootstrapSessionOptions {
    pid_t pid = -1;
    std::string run_id;
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

struct BootstrapTargetIdentity {
    pid_t pid = -1;
    uid_t owner_uid = 0;
    std::string executable;
    std::uint64_t start_seconds = 0U;
    std::uint64_t start_microseconds = 0U;
    TargetArchitecture architecture = TargetArchitecture::kUnsupported;
};

enum class BootstrapSessionState {
    kLoaded,
    kEntrypointsResolved,
    kCleanupPending,
    kCleaned,
};

struct RemoteBootstrapSession {
    std::string run_id;
    BootstrapTargetIdentity target;
    std::string bootstrap_path;
    std::string bootstrap_sha256;
    std::uint32_t bootstrap_abi_version = opus::bootstrap::kAbiVersion;
    std::uint64_t module_handle = 0U;
    std::uint64_t start_entrypoint = 0U;
    std::uint64_t stop_entrypoint = 0U;
    BootstrapSessionState state = BootstrapSessionState::kLoaded;
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

bool is_safe_run_id(const std::string& run_id) {
    if (run_id.empty() || run_id.size() > 128U) {
        return false;
    }
    for (const unsigned char character : run_id) {
        if (
            !(character >= 'a' && character <= 'z') &&
            !(character >= 'A' && character <= 'Z') &&
            !(character >= '0' && character <= '9') &&
            character != '-' && character != '_' && character != '.'
        ) {
            return false;
        }
    }
    return run_id.front() != '.';
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

bool parse_bootstrap_load_arguments(
    int argc,
    char* argv[],
    BootstrapLoadOptions* options
) {
    if (
        options == nullptr || argc != 8 ||
        std::strcmp(argv[1], "bootstrap-load") != 0 ||
        std::strcmp(argv[2], "--pid") != 0 ||
        std::strcmp(argv[4], "--bootstrap") != 0 ||
        std::strcmp(argv[6], "--run-id") != 0 ||
        !parse_positive_pid(argv[3], &options->pid) ||
        argv[5] == nullptr || *argv[5] == '\0' ||
        argv[7] == nullptr
    ) {
        return false;
    }
    options->bootstrap_path = argv[5];
    options->run_id = argv[7];
    return is_safe_run_id(options->run_id);
}

bool parse_bootstrap_session_arguments(
    int argc,
    char* argv[],
    const char* command,
    BootstrapSessionOptions* options
) {
    if (
        options == nullptr || command == nullptr || argc != 6 ||
        std::strcmp(argv[1], command) != 0 ||
        std::strcmp(argv[2], "--pid") != 0 ||
        std::strcmp(argv[4], "--run-id") != 0 ||
        !parse_positive_pid(argv[3], &options->pid) ||
        argv[5] == nullptr
    ) {
        return false;
    }
    options->run_id = argv[5];
    return is_safe_run_id(options->run_id);
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

bool same_bootstrap_target_identity(
    const BootstrapTargetIdentity& left,
    const BootstrapTargetIdentity& right
) {
    return left.pid == right.pid &&
        left.owner_uid == right.owner_uid &&
        left.executable == right.executable &&
        left.start_seconds == right.start_seconds &&
        left.start_microseconds == right.start_microseconds &&
        left.architecture == right.architecture;
}

bool inspect_owned_bootstrap_fixture_target(
    pid_t pid,
    BootstrapTargetIdentity* identity,
    std::string* failure
) {
    if (identity == nullptr || failure == nullptr) {
        return false;
    }

    proc_bsdinfo process_info {};
    const int process_info_size = proc_pidinfo(
        pid,
        PROC_PIDTBSDINFO,
        0,
        &process_info,
        PROC_PIDTBSDINFO_SIZE
    );
    if (process_info_size != PROC_PIDTBSDINFO_SIZE) {
        *failure =
            "BootstrapTargetIdentityUnavailable pid=" +
            std::to_string(pid) + " source=proc_pidinfo";
        return false;
    }
    if (process_info.pbi_uid != getuid()) {
        *failure =
            "BootstrapFixtureTargetRejected pid=" + std::to_string(pid) +
            " reason=owner_not_current_user";
        return false;
    }

    std::array<char, PROC_PIDPATHINFO_MAXSIZE> executable_path {};
    if (
        proc_pidpath(
            pid,
            executable_path.data(),
            static_cast<std::uint32_t>(executable_path.size())
        ) <= 0
    ) {
        *failure =
            "BootstrapTargetIdentityUnavailable pid=" +
            std::to_string(pid) + " source=proc_pidpath";
        return false;
    }

    std::array<char, PATH_MAX> canonical_path {};
    if (
        realpath(executable_path.data(), canonical_path.data()) == nullptr
    ) {
        *failure =
            "BootstrapTargetIdentityUnavailable pid=" +
            std::to_string(pid) + " source=realpath";
        return false;
    }
    const std::string executable(canonical_path.data());
    const std::size_t separator = executable.find_last_of('/');
    const std::string basename =
        separator == std::string::npos
            ? executable
            : executable.substr(separator + 1U);
    if (basename != kOwnedBootstrapFixtureBasename) {
        *failure =
            "BootstrapFixtureTargetRejected pid=" + std::to_string(pid) +
            " reason=unexpected_executable";
        return false;
    }
    if (
        process_info.pbi_start_tvsec == 0U &&
        process_info.pbi_start_tvusec == 0U
    ) {
        *failure =
            "BootstrapTargetIdentityUnavailable pid=" +
            std::to_string(pid) + " source=process_start_time";
        return false;
    }

    identity->pid = pid;
    identity->owner_uid = process_info.pbi_uid;
    identity->executable = executable;
    identity->start_seconds = process_info.pbi_start_tvsec;
    identity->start_microseconds = process_info.pbi_start_tvusec;
    identity->architecture = TargetArchitecture::kUnsupported;
    return true;
}

bool acquire_owned_bootstrap_fixture_target(
    pid_t pid,
    TargetTask* target,
    BootstrapTargetIdentity* identity,
    std::string* failure
) {
    if (target == nullptr || identity == nullptr || failure == nullptr) {
        return false;
    }

    BootstrapTargetIdentity before;
    if (!inspect_owned_bootstrap_fixture_target(pid, &before, failure)) {
        return false;
    }
    if (!acquire_target_task(pid, target, failure)) {
        return false;
    }
    before.architecture = target->architecture;

    BootstrapTargetIdentity after;
    if (!inspect_owned_bootstrap_fixture_target(pid, &after, failure)) {
        (void)release_target_task(target, nullptr);
        return false;
    }
    after.architecture = target->architecture;
    if (!same_bootstrap_target_identity(before, after)) {
        (void)release_target_task(target, nullptr);
        *failure =
            "BootstrapTargetIdentityMismatch pid=" + std::to_string(pid) +
            " reason=changed_during_task_port_acquisition";
        return false;
    }

    *identity = after;
    return true;
}

bool revalidate_owned_bootstrap_fixture_target(
    pid_t pid,
    const BootstrapTargetIdentity& expected,
    std::string* failure
) {
    BootstrapTargetIdentity observed;
    if (!inspect_owned_bootstrap_fixture_target(pid, &observed, failure)) {
        return false;
    }
    observed.architecture = expected.architecture;
    if (!same_bootstrap_target_identity(expected, observed)) {
        *failure =
            "BootstrapTargetIdentityMismatch pid=" + std::to_string(pid) +
            " reason=retained_session_target_changed";
        return false;
    }
    return true;
}

bool acquire_revalidated_bootstrap_session_target(
    pid_t requested_pid,
    const RemoteBootstrapSession& session,
    TargetTask* target,
    std::string* failure
) {
    if (requested_pid != session.target.pid) {
        if (failure != nullptr) {
            *failure =
                "BootstrapTargetIdentityMismatch pid=" +
                std::to_string(requested_pid) +
                " reason=pid_does_not_match_retained_session";
        }
        return false;
    }

    BootstrapTargetIdentity observed;
    if (
        !acquire_owned_bootstrap_fixture_target(
            requested_pid,
            target,
            &observed,
            failure
        )
    ) {
        return false;
    }
    if (!same_bootstrap_target_identity(session.target, observed)) {
        (void)release_target_task(target, nullptr);
        if (failure != nullptr) {
            *failure =
                "BootstrapTargetIdentityMismatch pid=" +
                std::to_string(requested_pid) +
                " reason=retained_session_target_changed";
        }
        return false;
    }
    return true;
}

std::string hex_u64(std::uint64_t value) {
    std::array<char, 17> encoded {};
    const int length = std::snprintf(
        encoded.data(),
        encoded.size(),
        "%016llx",
        static_cast<unsigned long long>(value)
    );
    return length == 16 ? std::string(encoded.data()) : std::string();
}

bool parse_decimal_u64(const std::string& value, std::uint64_t* parsed) {
    if (parsed == nullptr || value.empty()) {
        return false;
    }
    char* end = nullptr;
    errno = 0;
    const unsigned long long result = std::strtoull(
        value.c_str(),
        &end,
        10
    );
    if (
        errno != 0 || end == value.c_str() || *end != '\0' ||
        result > std::numeric_limits<std::uint64_t>::max()
    ) {
        return false;
    }
    *parsed = static_cast<std::uint64_t>(result);
    return true;
}

bool parse_hex_u64(const std::string& value, std::uint64_t* parsed) {
    if (parsed == nullptr || value.size() != 16U) {
        return false;
    }
    std::uint64_t result = 0U;
    for (const unsigned char character : value) {
        std::uint8_t digit = 0U;
        if (character >= '0' && character <= '9') {
            digit = static_cast<std::uint8_t>(character - '0');
        } else if (character >= 'a' && character <= 'f') {
            digit = static_cast<std::uint8_t>(character - 'a' + 10U);
        } else {
            return false;
        }
        result = (result << 4U) | digit;
    }
    *parsed = result;
    return true;
}

bool is_lower_hex(const std::string& value, std::size_t expected_size) {
    return value.size() == expected_size &&
        value.find_first_not_of("0123456789abcdef") == std::string::npos;
}

std::string percent_encode(const std::string& value) {
    static constexpr char kHexDigits[] = "0123456789ABCDEF";
    std::string encoded;
    encoded.reserve(value.size());
    for (const unsigned char character : value) {
        if (
            (character >= 'a' && character <= 'z') ||
            (character >= 'A' && character <= 'Z') ||
            (character >= '0' && character <= '9') ||
            character == '-' || character == '.' || character == '_' ||
            character == '~'
        ) {
            encoded.push_back(static_cast<char>(character));
            continue;
        }
        encoded.push_back('%');
        encoded.push_back(kHexDigits[(character >> 4U) & 0x0fU]);
        encoded.push_back(kHexDigits[character & 0x0fU]);
    }
    return encoded;
}

bool decode_hex_nibble(unsigned char character, std::uint8_t* result) {
    if (result == nullptr) {
        return false;
    }
    if (character >= '0' && character <= '9') {
        *result = static_cast<std::uint8_t>(character - '0');
        return true;
    }
    if (character >= 'A' && character <= 'F') {
        *result = static_cast<std::uint8_t>(character - 'A' + 10U);
        return true;
    }
    return false;
}

bool percent_decode(const std::string& encoded, std::string* value) {
    if (value == nullptr) {
        return false;
    }
    std::string decoded;
    decoded.reserve(encoded.size());
    for (std::size_t index = 0U; index < encoded.size(); ++index) {
        const unsigned char character =
            static_cast<unsigned char>(encoded[index]);
        if (character != '%') {
            if (character == '\r' || character == '\n' || character == '\0') {
                return false;
            }
            decoded.push_back(static_cast<char>(character));
            continue;
        }
        if (index + 2U >= encoded.size()) {
            return false;
        }
        std::uint8_t high = 0U;
        std::uint8_t low = 0U;
        if (
            !decode_hex_nibble(
                static_cast<unsigned char>(encoded[index + 1U]),
                &high
            ) ||
            !decode_hex_nibble(
                static_cast<unsigned char>(encoded[index + 2U]),
                &low
            )
        ) {
            return false;
        }
        const unsigned char decoded_character =
            static_cast<unsigned char>((high << 4U) | low);
        if (
            decoded_character == '\r' || decoded_character == '\n' ||
            decoded_character == '\0'
        ) {
            return false;
        }
        decoded.push_back(static_cast<char>(decoded_character));
        index += 2U;
    }
    *value = decoded;
    return true;
}

const char* bootstrap_session_state_name(BootstrapSessionState state) {
    switch (state) {
        case BootstrapSessionState::kLoaded:
            return "loaded";
        case BootstrapSessionState::kEntrypointsResolved:
            return "entrypoints-resolved";
        case BootstrapSessionState::kCleanupPending:
            return "cleanup-pending";
        case BootstrapSessionState::kCleaned:
            return "cleaned";
    }
    return "invalid";
}

bool parse_bootstrap_session_state(
    const std::string& value,
    BootstrapSessionState* state
) {
    if (state == nullptr) {
        return false;
    }
    if (value == "loaded") {
        *state = BootstrapSessionState::kLoaded;
        return true;
    }
    if (value == "entrypoints-resolved") {
        *state = BootstrapSessionState::kEntrypointsResolved;
        return true;
    }
    if (value == "cleanup-pending") {
        *state = BootstrapSessionState::kCleanupPending;
        return true;
    }
    if (value == "cleaned") {
        *state = BootstrapSessionState::kCleaned;
        return true;
    }
    return false;
}

bool sha256_file(
    const std::string& path,
    std::string* digest,
    std::string* failure
) {
    if (digest == nullptr || failure == nullptr) {
        return false;
    }

    const int descriptor = open(path.c_str(), O_RDONLY | O_CLOEXEC);
    if (descriptor < 0) {
        *failure = "BootstrapArtifactIdentityMismatch reason=cannot_open";
        return false;
    }

    CC_SHA256_CTX context {};
    CC_SHA256_Init(&context);
    std::array<unsigned char, 8192U> bytes {};
    bool read_failed = false;
    while (true) {
        const ssize_t count = read(descriptor, bytes.data(), bytes.size());
        if (count == 0) {
            break;
        }
        if (count < 0) {
            if (errno == EINTR) {
                continue;
            }
            read_failed = true;
            break;
        }
        CC_SHA256_Update(
            &context,
            bytes.data(),
            static_cast<CC_LONG>(count)
        );
    }
    const int close_result = close(descriptor);
    if (read_failed || close_result != 0) {
        *failure = "BootstrapArtifactIdentityMismatch reason=cannot_read";
        return false;
    }

    std::array<unsigned char, CC_SHA256_DIGEST_LENGTH> raw_digest {};
    CC_SHA256_Final(raw_digest.data(), &context);
    std::string encoded;
    encoded.reserve(raw_digest.size() * 2U);
    static constexpr char kHexDigits[] = "0123456789abcdef";
    for (const unsigned char byte : raw_digest) {
        encoded.push_back(kHexDigits[(byte >> 4U) & 0x0fU]);
        encoded.push_back(kHexDigits[byte & 0x0fU]);
    }
    *digest = encoded;
    return true;
}

std::string bootstrap_session_directory() {
    return std::string(kBootstrapSessionDirectoryPrefix) +
        std::to_string(static_cast<unsigned long long>(getuid()));
}

std::string bootstrap_session_path(const std::string& run_id) {
    return bootstrap_session_directory() + "/" + run_id +
        kBootstrapSessionSuffix;
}

bool is_private_bootstrap_session_directory(
    const struct stat& metadata
) {
    return S_ISDIR(metadata.st_mode) && metadata.st_uid == getuid() &&
        (metadata.st_mode & (S_IRWXG | S_IRWXO)) == 0;
}

bool ensure_private_bootstrap_session_directory(std::string* failure) {
    const std::string directory = bootstrap_session_directory();
    if (mkdir(directory.c_str(), S_IRWXU) != 0 && errno != EEXIST) {
        if (failure != nullptr) {
            *failure = "BootstrapSessionStorageFailed reason=mkdir";
        }
        return false;
    }
    struct stat metadata {};
    if (
        lstat(directory.c_str(), &metadata) != 0 ||
        !is_private_bootstrap_session_directory(metadata)
    ) {
        if (failure != nullptr) {
            *failure = "BootstrapSessionStorageFailed reason=directory_not_private";
        }
        return false;
    }
    return true;
}

bool is_private_bootstrap_session_file(
    const struct stat& metadata
) {
    return S_ISREG(metadata.st_mode) && metadata.st_uid == getuid() &&
        metadata.st_nlink == 1 &&
        (metadata.st_mode & (S_IRWXG | S_IRWXO)) == 0 &&
        metadata.st_size > 0 &&
        static_cast<std::uint64_t>(metadata.st_size) <=
            kMaximumBootstrapSessionBytes;
}

bool write_all_bytes(
    int descriptor,
    const std::string& contents
) {
    const char* cursor = contents.data();
    std::size_t remaining = contents.size();
    while (remaining > 0U) {
        const ssize_t written = write(descriptor, cursor, remaining);
        if (written < 0) {
            if (errno == EINTR) {
                continue;
            }
            return false;
        }
        if (written == 0) {
            return false;
        }
        cursor += written;
        remaining -= static_cast<std::size_t>(written);
    }
    return true;
}

std::string serialize_remote_bootstrap_session(
    const RemoteBootstrapSession& session
) {
    return
        "schemaVersion=" +
            std::to_string(kBootstrapSessionSchemaVersion) + "\n" +
        "runId=" + session.run_id + "\n" +
        "pid=" + std::to_string(session.target.pid) + "\n" +
        "ownerUid=" +
            std::to_string(
                static_cast<unsigned long long>(session.target.owner_uid)
            ) +
            "\n" +
        "targetExecutable=" + percent_encode(session.target.executable) +
            "\n" +
        "targetStartSeconds=" +
            std::to_string(session.target.start_seconds) + "\n" +
        "targetStartMicroseconds=" +
            std::to_string(session.target.start_microseconds) + "\n" +
        "targetArchitecture=" +
            architecture_name(session.target.architecture) + "\n" +
        "bootstrapPath=" + percent_encode(session.bootstrap_path) + "\n" +
        "bootstrapSha256=" + session.bootstrap_sha256 + "\n" +
        "bootstrapAbiVersion=" +
            std::to_string(session.bootstrap_abi_version) + "\n" +
        "moduleHandle=" + hex_u64(session.module_handle) + "\n" +
        "startEntrypoint=" + hex_u64(session.start_entrypoint) + "\n" +
        "stopEntrypoint=" + hex_u64(session.stop_entrypoint) + "\n" +
        "state=" + bootstrap_session_state_name(session.state) + "\n" +
        "cleanupOwner=transport-helper\n";
}

bool write_remote_bootstrap_session(
    const RemoteBootstrapSession& session,
    bool create,
    std::string* failure
) {
    if (!is_safe_run_id(session.run_id)) {
        if (failure != nullptr) {
            *failure = "BootstrapRunIdInvalid";
        }
        return false;
    }
    if (!ensure_private_bootstrap_session_directory(failure)) {
        return false;
    }

    const std::string path = bootstrap_session_path(session.run_id);
    int flags = O_WRONLY | O_CLOEXEC | O_NOFOLLOW;
    if (create) {
        flags |= O_CREAT | O_EXCL;
    }
    const int descriptor = open(path.c_str(), flags, S_IRUSR | S_IWUSR);
    if (descriptor < 0) {
        if (failure != nullptr) {
            *failure =
                errno == EEXIST
                    ? "BootstrapSessionExists run_id=" + session.run_id
                    : "BootstrapSessionStorageFailed reason=open";
        }
        return false;
    }

    bool valid_existing_file = true;
    struct stat metadata {};
    if (!create) {
        valid_existing_file =
            fstat(descriptor, &metadata) == 0 &&
            is_private_bootstrap_session_file(metadata);
    }
    const std::string contents = serialize_remote_bootstrap_session(session);
    const bool write_succeeded =
        valid_existing_file &&
        ftruncate(descriptor, 0) == 0 &&
        write_all_bytes(descriptor, contents) &&
        fsync(descriptor) == 0;
    const int close_result = close(descriptor);
    if (!write_succeeded || close_result != 0) {
        if (failure != nullptr) {
            *failure =
                "BootstrapSessionStorageFailed reason=write";
        }
        return false;
    }
    return true;
}

bool read_private_bootstrap_session_contents(
    const std::string& run_id,
    std::string* contents,
    std::string* failure
) {
    if (contents == nullptr || failure == nullptr) {
        return false;
    }

    const std::string directory = bootstrap_session_directory();
    struct stat directory_metadata {};
    if (lstat(directory.c_str(), &directory_metadata) != 0) {
        *failure =
            errno == ENOENT
                ? "BootstrapRunContextMismatch run_id=" + run_id +
                    " reason=session_not_found"
                : "BootstrapSessionStorageFailed reason=directory";
        return false;
    }
    if (!is_private_bootstrap_session_directory(directory_metadata)) {
        *failure = "BootstrapSessionStorageFailed reason=directory_not_private";
        return false;
    }

    const std::string path = bootstrap_session_path(run_id);
    struct stat path_metadata {};
    if (lstat(path.c_str(), &path_metadata) != 0) {
        *failure =
            errno == ENOENT
                ? "BootstrapRunContextMismatch run_id=" + run_id +
                    " reason=session_not_found"
                : "BootstrapSessionStorageFailed reason=session_stat";
        return false;
    }
    if (!is_private_bootstrap_session_file(path_metadata)) {
        *failure = "BootstrapSessionInvalid reason=file_not_private";
        return false;
    }

    const int descriptor =
        open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (descriptor < 0) {
        *failure = "BootstrapSessionStorageFailed reason=session_open";
        return false;
    }
    struct stat descriptor_metadata {};
    const bool descriptor_valid =
        fstat(descriptor, &descriptor_metadata) == 0 &&
        descriptor_metadata.st_dev == path_metadata.st_dev &&
        descriptor_metadata.st_ino == path_metadata.st_ino &&
        is_private_bootstrap_session_file(descriptor_metadata);
    if (!descriptor_valid) {
        (void)close(descriptor);
        *failure = "BootstrapSessionInvalid reason=file_changed";
        return false;
    }

    std::string result;
    result.resize(static_cast<std::size_t>(descriptor_metadata.st_size));
    std::size_t offset = 0U;
    bool read_succeeded = true;
    while (offset < result.size()) {
        const ssize_t count = read(
            descriptor,
            result.data() + offset,
            result.size() - offset
        );
        if (count < 0) {
            if (errno == EINTR) {
                continue;
            }
            read_succeeded = false;
            break;
        }
        if (count == 0) {
            read_succeeded = false;
            break;
        }
        offset += static_cast<std::size_t>(count);
    }
    const int close_result = close(descriptor);
    if (!read_succeeded || close_result != 0) {
        *failure = "BootstrapSessionStorageFailed reason=session_read";
        return false;
    }
    *contents = result;
    return true;
}

bool read_session_properties(
    const std::string& contents,
    std::map<std::string, std::string>* properties
) {
    if (properties == nullptr || contents.empty()) {
        return false;
    }
    std::size_t start = 0U;
    while (start < contents.size()) {
        const std::size_t end = contents.find('\n', start);
        const std::size_t length =
            end == std::string::npos ? contents.size() - start : end - start;
        if (length == 0U) {
            return false;
        }
        const std::string line = contents.substr(start, length);
        const std::size_t separator = line.find('=');
        if (
            separator == std::string::npos || separator == 0U ||
            separator + 1U >= line.size()
        ) {
            return false;
        }
        const std::string key = line.substr(0U, separator);
        const std::string value = line.substr(separator + 1U);
        for (const unsigned char character : key) {
            if (
                !((character >= 'a' && character <= 'z') ||
                  (character >= 'A' && character <= 'Z') ||
                  (character >= '0' && character <= '9'))
            ) {
                return false;
            }
        }
        if (
            value.find('\r') != std::string::npos ||
            value.find('\n') != std::string::npos ||
            value.find('\0') != std::string::npos ||
            !properties->emplace(key, value).second
        ) {
            return false;
        }
        if (end == std::string::npos) {
            break;
        }
        start = end + 1U;
    }
    return !properties->empty();
}

const std::string* required_session_property(
    const std::map<std::string, std::string>& properties,
    const char* key
) {
    const auto iterator = properties.find(key);
    return iterator == properties.end() ? nullptr : &iterator->second;
}

bool parse_remote_bootstrap_session(
    const std::string& contents,
    const std::string& requested_run_id,
    RemoteBootstrapSession* session,
    std::string* failure
) {
    if (session == nullptr || failure == nullptr) {
        return false;
    }

    std::map<std::string, std::string> properties;
    if (!read_session_properties(contents, &properties) || properties.size() != 16U) {
        *failure = "BootstrapSessionInvalid reason=properties";
        return false;
    }
    const std::array<const char*, 16U> required = {
        "schemaVersion",
        "runId",
        "pid",
        "ownerUid",
        "targetExecutable",
        "targetStartSeconds",
        "targetStartMicroseconds",
        "targetArchitecture",
        "bootstrapPath",
        "bootstrapSha256",
        "bootstrapAbiVersion",
        "moduleHandle",
        "startEntrypoint",
        "stopEntrypoint",
        "state",
        "cleanupOwner",
    };
    for (const char* key : required) {
        if (required_session_property(properties, key) == nullptr) {
            *failure = "BootstrapSessionInvalid reason=missing_field";
            return false;
        }
    }

    std::uint64_t parsed_value = 0U;
    const std::string* schema_version =
        required_session_property(properties, "schemaVersion");
    if (
        !parse_decimal_u64(*schema_version, &parsed_value) ||
        parsed_value != kBootstrapSessionSchemaVersion
    ) {
        *failure = "BootstrapSessionInvalid reason=schema_version";
        return false;
    }

    const std::string* run_id = required_session_property(properties, "runId");
    if (
        !is_safe_run_id(*run_id) || *run_id != requested_run_id
    ) {
        *failure =
            "BootstrapRunContextMismatch run_id=" + requested_run_id +
            " reason=retained_run_id_differs";
        return false;
    }

    const std::string* pid = required_session_property(properties, "pid");
    if (
        !parse_decimal_u64(*pid, &parsed_value) || parsed_value == 0U ||
        parsed_value > static_cast<std::uint64_t>(
            std::numeric_limits<pid_t>::max()
        )
    ) {
        *failure = "BootstrapSessionInvalid reason=pid";
        return false;
    }
    session->target.pid = static_cast<pid_t>(parsed_value);

    const std::string* owner_uid =
        required_session_property(properties, "ownerUid");
    if (
        !parse_decimal_u64(*owner_uid, &parsed_value) ||
        parsed_value != static_cast<std::uint64_t>(getuid())
    ) {
        *failure = "BootstrapSessionInvalid reason=owner";
        return false;
    }
    session->target.owner_uid = static_cast<uid_t>(parsed_value);

    const std::string* executable =
        required_session_property(properties, "targetExecutable");
    if (
        !percent_decode(*executable, &session->target.executable) ||
        session->target.executable.empty()
    ) {
        *failure = "BootstrapSessionInvalid reason=target_executable";
        return false;
    }
    const std::size_t separator = session->target.executable.find_last_of('/');
    if (
        separator == std::string::npos ||
        session->target.executable.substr(separator + 1U) !=
            kOwnedBootstrapFixtureBasename
    ) {
        *failure = "BootstrapSessionInvalid reason=fixture_executable";
        return false;
    }

    const std::string* start_seconds =
        required_session_property(properties, "targetStartSeconds");
    const std::string* start_microseconds =
        required_session_property(properties, "targetStartMicroseconds");
    if (
        !parse_decimal_u64(*start_seconds, &session->target.start_seconds) ||
        !parse_decimal_u64(
            *start_microseconds,
            &session->target.start_microseconds
        ) ||
        (
            session->target.start_seconds == 0U &&
            session->target.start_microseconds == 0U
        )
    ) {
        *failure = "BootstrapSessionInvalid reason=target_start_time";
        return false;
    }

    const std::string* architecture =
        required_session_property(properties, "targetArchitecture");
    if (*architecture == "arm64") {
        session->target.architecture = TargetArchitecture::kArm64;
    } else if (*architecture == "x86_64") {
        session->target.architecture = TargetArchitecture::kX86_64;
    } else {
        *failure = "BootstrapSessionInvalid reason=target_architecture";
        return false;
    }

    const std::string* bootstrap_path =
        required_session_property(properties, "bootstrapPath");
    if (
        !percent_decode(*bootstrap_path, &session->bootstrap_path) ||
        session->bootstrap_path.empty() ||
        session->bootstrap_path.front() != '/'
    ) {
        *failure = "BootstrapSessionInvalid reason=bootstrap_path";
        return false;
    }
    const std::string* bootstrap_sha256 =
        required_session_property(properties, "bootstrapSha256");
    if (!is_lower_hex(*bootstrap_sha256, 64U)) {
        *failure = "BootstrapSessionInvalid reason=bootstrap_sha256";
        return false;
    }
    session->bootstrap_sha256 = *bootstrap_sha256;

    const std::string* abi_version =
        required_session_property(properties, "bootstrapAbiVersion");
    if (
        !parse_decimal_u64(*abi_version, &parsed_value) ||
        parsed_value == 0U ||
        parsed_value > std::numeric_limits<std::uint32_t>::max()
    ) {
        *failure = "BootstrapSessionInvalid reason=bootstrap_abi_version";
        return false;
    }
    session->bootstrap_abi_version = static_cast<std::uint32_t>(parsed_value);

    const std::string* module_handle =
        required_session_property(properties, "moduleHandle");
    const std::string* start_entrypoint =
        required_session_property(properties, "startEntrypoint");
    const std::string* stop_entrypoint =
        required_session_property(properties, "stopEntrypoint");
    if (
        !parse_hex_u64(*module_handle, &session->module_handle) ||
        !parse_hex_u64(*start_entrypoint, &session->start_entrypoint) ||
        !parse_hex_u64(*stop_entrypoint, &session->stop_entrypoint)
    ) {
        *failure = "BootstrapSessionInvalid reason=remote_values";
        return false;
    }

    const std::string* state = required_session_property(properties, "state");
    if (!parse_bootstrap_session_state(*state, &session->state)) {
        *failure = "BootstrapSessionInvalid reason=state";
        return false;
    }
    const std::string* cleanup_owner =
        required_session_property(properties, "cleanupOwner");
    if (*cleanup_owner != "transport-helper") {
        *failure = "BootstrapSessionInvalid reason=cleanup_owner";
        return false;
    }

    if (
        session->state == BootstrapSessionState::kCleaned
    ) {
        if (
            session->module_handle != 0U ||
            session->start_entrypoint != 0U ||
            session->stop_entrypoint != 0U
        ) {
            *failure = "BootstrapSessionInvalid reason=cleaned_values";
            return false;
        }
    } else if (session->module_handle == 0U) {
        *failure = "BootstrapSessionInvalid reason=missing_module_handle";
        return false;
    }
    if (
        session->state == BootstrapSessionState::kEntrypointsResolved &&
        (
            session->start_entrypoint == 0U ||
            session->stop_entrypoint == 0U
        )
    ) {
        *failure = "BootstrapSessionInvalid reason=missing_entrypoints";
        return false;
    }

    session->run_id = *run_id;
    return true;
}

bool read_remote_bootstrap_session(
    const std::string& run_id,
    RemoteBootstrapSession* session,
    std::string* failure
) {
    std::string contents;
    if (!read_private_bootstrap_session_contents(run_id, &contents, failure)) {
        return false;
    }
    return parse_remote_bootstrap_session(contents, run_id, session, failure);
}

bool verify_remote_bootstrap_session_artifact(
    const RemoteBootstrapSession& session,
    std::string* failure
) {
    if (session.bootstrap_abi_version != opus::bootstrap::kAbiVersion) {
        if (failure != nullptr) {
            *failure = "BootstrapAbiUnsupported";
        }
        return false;
    }

    std::string canonical_path;
    if (!canonical_runtime_path(session.bootstrap_path, &canonical_path)) {
        if (failure != nullptr) {
            *failure =
                "BootstrapArtifactIdentityMismatch reason=path_changed";
        }
        return false;
    }
    std::string observed_sha256;
    if (!sha256_file(canonical_path, &observed_sha256, failure)) {
        return false;
    }
    if (
        canonical_path != session.bootstrap_path ||
        observed_sha256 != session.bootstrap_sha256
    ) {
        if (failure != nullptr) {
            *failure =
                "BootstrapArtifactIdentityMismatch reason=retained_identity_changed";
        }
        return false;
    }
    return true;
}

bool verify_bootstrap_session_is_active(
    const RemoteBootstrapSession& session,
    std::string* failure
) {
    if (session.state == BootstrapSessionState::kCleaned) {
        if (failure != nullptr) {
            *failure =
                "BootstrapSessionAlreadyCleaned run_id=" + session.run_id;
        }
        return false;
    }
    if (session.state == BootstrapSessionState::kCleanupPending) {
        if (failure != nullptr) {
            *failure =
                "BootstrapSessionCleanupRequired run_id=" + session.run_id;
        }
        return false;
    }
    return true;
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

enum class RemoteStringArgument {
    kNone,
    kArgument0,
    kArgument1,
};

struct RemoteCallRequest {
    mach_vm_address_t function_address = 0;
    std::uint64_t argument0 = 0U;
    std::uint64_t argument1 = 0U;
    const std::string* string_argument = nullptr;
    RemoteStringArgument string_position = RemoteStringArgument::kNone;
};

bool invoke_remote_two_argument_call(
    TargetTask* target,
    pid_t pid,
    const RemoteCallRequest& request,
    const char* operation,
    std::uint64_t* return_value,
    std::string* failure
) {
    if (
        target == nullptr || target->port == MACH_PORT_NULL ||
        operation == nullptr || return_value == nullptr || failure == nullptr ||
        request.function_address == 0U
    ) {
        return false;
    }
    const bool has_string_argument =
        request.string_position != RemoteStringArgument::kNone;
    if (
        has_string_argument &&
        (request.string_argument == nullptr || request.string_argument->empty())
    ) {
        *failure = std::string(operation) + "ArgumentInvalid";
        return false;
    }
    if (
        !has_string_argument && request.string_argument != nullptr
    ) {
        *failure = std::string(operation) + "ArgumentInvalid";
        return false;
    }

    mach_vm_address_t remote_pthread_create_from_mach_thread = 0;
    std::string operation_failure;
    if (!resolve_remote_symbol(
            target->port,
            "pthread_create_from_mach_thread",
            &remote_pthread_create_from_mach_thread,
            &operation_failure
        )) {
        *failure =
            std::string(operation) + "PthreadSymbolUnavailable " +
            operation_failure;
        return false;
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
        *failure = std::string(operation) + "BootstrapInvalid";
        return false;
    }

    mach_vm_address_t remote_data = 0;
    mach_vm_address_t remote_code = 0;
    if (
        !allocate_remote_memory(
            target->port,
            kRemoteDataSize,
            &remote_data,
            &operation_failure
        ) ||
        !allocate_remote_memory(
            target->port,
            kRemoteCodeSize,
            &remote_code,
            &operation_failure
        )
    ) {
        release_remote_memory(target->port, remote_code, kRemoteCodeSize);
        release_remote_memory(target->port, remote_data, kRemoteDataSize);
        *failure =
            std::string(operation) + "AllocationFailed pid=" +
            std::to_string(pid) + " " + operation_failure;
        return false;
    }

    const mach_vm_address_t remote_string =
        remote_data + sizeof(RemoteCallContext);
    std::size_t string_end = sizeof(RemoteCallContext);
    if (has_string_argument) {
        string_end += request.string_argument->size() + 1U;
    }
    const std::size_t pthread_storage_offset =
        (string_end + alignof(std::uint64_t) - 1U) &
        ~(alignof(std::uint64_t) - 1U);
    if (
        pthread_storage_offset + sizeof(std::uint64_t) > kRemoteDataSize
    ) {
        release_remote_memory(target->port, remote_code, kRemoteCodeSize);
        release_remote_memory(target->port, remote_data, kRemoteDataSize);
        *failure = std::string(operation) + "ArgumentTooLong";
        return false;
    }

    RemoteCallContext context {};
    context.function_address = request.function_address;
    context.argument0 = request.argument0;
    context.argument1 = request.argument1;
    if (has_string_argument) {
        if (request.string_position == RemoteStringArgument::kArgument0) {
            context.argument0 = remote_string;
        } else if (
            request.string_position == RemoteStringArgument::kArgument1
        ) {
            context.argument1 = remote_string;
        } else {
            release_remote_memory(target->port, remote_code, kRemoteCodeSize);
            release_remote_memory(target->port, remote_data, kRemoteDataSize);
            *failure = std::string(operation) + "ArgumentInvalid";
            return false;
        }
    }
    context.pthread_create_from_mach_thread_address =
        remote_pthread_create_from_mach_thread;
    context.worker_entry_address =
        remote_code +
        static_cast<mach_vm_address_t>(worker_start - bootstrap_start);
    context.pthread_storage_address =
        remote_data + static_cast<mach_vm_address_t>(pthread_storage_offset);

    const bool write_succeeded =
        write_remote_bytes(
            target->port,
            remote_data,
            &context,
            sizeof(context),
            &operation_failure
        ) &&
        (
            !has_string_argument ||
            write_remote_bytes(
                target->port,
                remote_string,
                request.string_argument->c_str(),
                static_cast<mach_msg_type_number_t>(
                    request.string_argument->size() + 1U
                ),
                &operation_failure
            )
        ) &&
        write_remote_bytes(
            target->port,
            remote_code,
            opus_remote_loader_bootstrap_start,
            static_cast<mach_msg_type_number_t>(worker_end - bootstrap_start),
            &operation_failure
        );
    if (!write_succeeded) {
        release_remote_memory(target->port, remote_code, kRemoteCodeSize);
        release_remote_memory(target->port, remote_data, kRemoteDataSize);
        *failure =
            std::string(operation) + "WriteFailed pid=" +
            std::to_string(pid) + " " + operation_failure;
        return false;
    }

    const kern_return_t protect_result = mach_vm_protect(
        target->port,
        remote_code,
        kRemoteCodeSize,
        false,
        VM_PROT_READ | VM_PROT_EXECUTE
    );
    if (protect_result != KERN_SUCCESS) {
        release_remote_memory(target->port, remote_code, kRemoteCodeSize);
        release_remote_memory(target->port, remote_data, kRemoteDataSize);
        *failure =
            std::string(operation) + "CodeProtectDenied " +
            mach_result_detail("mach_vm_protect", protect_result);
        return false;
    }

    thread_act_t loader_thread = MACH_PORT_NULL;
    if (!start_remote_loader_thread(
            target->port,
            remote_code,
            remote_data,
            remote_data,
            &loader_thread,
            &operation_failure
        )) {
        release_remote_memory(target->port, remote_code, kRemoteCodeSize);
        release_remote_memory(target->port, remote_data, kRemoteDataSize);
        *failure = operation_failure;
        return false;
    }

    RemoteCallContext completed_context {};
    bool worker_completed = false;
    bool pthread_creation_failed = false;
    for (
        int elapsed = 0;
        elapsed < kLoadCompletionTimeoutMilliseconds;
        elapsed += kLoadPollIntervalMilliseconds
    ) {
        if (!read_remote_value(
                target->port,
                remote_data,
                &completed_context,
                &operation_failure
            )) {
            (void)mach_port_deallocate(mach_task_self(), loader_thread);
            *failure =
                std::string(operation) + "ContextReadFailed pid=" +
                std::to_string(pid) + " " + operation_failure;
            return false;
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
        if (!terminate_loader_thread(loader_thread, &operation_failure)) {
            (void)mach_port_deallocate(mach_task_self(), loader_thread);
            *failure = operation_failure;
            return false;
        }
        (void)mach_port_deallocate(mach_task_self(), loader_thread);
        release_remote_memory(target->port, remote_code, kRemoteCodeSize);
        release_remote_memory(target->port, remote_data, kRemoteDataSize);
        *failure =
            std::string(operation) + "PthreadCreateFailed pid=" +
            std::to_string(pid) + " error=" +
            std::to_string(completed_context.pthread_create_result);
        return false;
    }

    if (!worker_completed) {
        (void)mach_port_deallocate(mach_task_self(), loader_thread);
        *failure =
            std::string(operation) + "TimedOut pid=" +
            std::to_string(pid) + " recovery=restart-target";
        return false;
    }

    std::this_thread::sleep_for(
        std::chrono::milliseconds(kLoadPollIntervalMilliseconds)
    );
    if (!terminate_loader_thread(loader_thread, &operation_failure)) {
        (void)mach_port_deallocate(mach_task_self(), loader_thread);
        *failure = operation_failure;
        return false;
    }
    (void)mach_port_deallocate(mach_task_self(), loader_thread);

    release_remote_memory(target->port, remote_code, kRemoteCodeSize);
    release_remote_memory(target->port, remote_data, kRemoteDataSize);
    *return_value = completed_context.return_value;
    return true;
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

bool bootstrap_session_file_exists(const std::string& run_id) {
    struct stat metadata {};
    return lstat(bootstrap_session_path(run_id).c_str(), &metadata) == 0;
}

bool remote_dlclose_module(
    TargetTask* target,
    pid_t pid,
    std::uint64_t module_handle,
    const char* operation,
    std::string* failure
) {
    if (
        target == nullptr || target->port == MACH_PORT_NULL ||
        module_handle == 0U || operation == nullptr || failure == nullptr
    ) {
        return false;
    }

    mach_vm_address_t remote_dlclose = 0;
    if (!resolve_remote_symbol(
            target->port,
            "dlclose",
            &remote_dlclose,
            failure
        )) {
        *failure =
            std::string(operation) + "DlcloseSymbolUnavailable " + *failure;
        return false;
    }

    RemoteCallRequest request;
    request.function_address = remote_dlclose;
    request.argument0 = module_handle;
    std::uint64_t return_value = 0U;
    if (!invoke_remote_two_argument_call(
            target,
            pid,
            request,
            operation,
            &return_value,
            failure
        )) {
        return false;
    }
    if (
        static_cast<std::int32_t>(
            static_cast<std::uint32_t>(return_value)
        ) != 0
    ) {
        *failure =
            std::string(operation) + "Failed pid=" + std::to_string(pid) +
            " reason=dlclose_nonzero";
        return false;
    }
    return true;
}

int bootstrap_load_remote_module(const BootstrapLoadOptions& options) {
    std::string bootstrap_path;
    if (!canonical_runtime_path(options.bootstrap_path, &bootstrap_path)) {
        return emit_structured_failure("BootstrapArtifactInvalid");
    }
    if (bootstrap_session_file_exists(options.run_id)) {
        return emit_structured_failure(
            "BootstrapSessionExists run_id=" + options.run_id
        );
    }

    std::string bootstrap_sha256;
    std::string failure;
    if (!sha256_file(bootstrap_path, &bootstrap_sha256, &failure)) {
        return emit_structured_failure(failure);
    }

    TargetTask target;
    BootstrapTargetIdentity target_identity;
    if (!acquire_owned_bootstrap_fixture_target(
            options.pid,
            &target,
            &target_identity,
            &failure
        )) {
        return emit_structured_failure(failure);
    }

    emit(
        "BootstrapTargetResolved",
        "pid=" + std::to_string(options.pid) +
            " target_architecture=" +
            architecture_name(target.architecture) +
            " target=opus-owned-external-fixture"
    );
    emit(
        "BootstrapTransportReady",
        "pid=" + std::to_string(options.pid) +
            " target_architecture=" +
            architecture_name(target.architecture) +
            " task_port=acquired"
    );
    emit(
        "BootstrapArtifactVerified",
        "pid=" + std::to_string(options.pid) +
            " artifact_identity=sha256-verified abi_version=" +
            std::to_string(opus::bootstrap::kAbiVersion)
    );

    mach_vm_address_t remote_dlopen = 0;
    if (!resolve_remote_symbol(
            target.port,
            "dlopen",
            &remote_dlopen,
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "BootstrapRemoteDlopenSymbolUnavailable " + failure
        );
    }

    RemoteCallRequest request;
    request.function_address = remote_dlopen;
    request.argument1 = static_cast<std::uint64_t>(
        static_cast<std::uint32_t>(RTLD_NOW | RTLD_LOCAL)
    );
    request.string_argument = &bootstrap_path;
    request.string_position = RemoteStringArgument::kArgument0;
    std::uint64_t module_handle = 0U;
    if (!invoke_remote_two_argument_call(
            &target,
            options.pid,
            request,
            "BootstrapRemoteLoad",
            &module_handle,
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (module_handle == 0U) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "BootstrapRemoteDlopenReturnedNull pid=" +
            std::to_string(options.pid)
        );
    }

    if (!revalidate_owned_bootstrap_fixture_target(
            options.pid,
            target_identity,
            &failure
        ) ||
        !verify_remote_bootstrap_session_artifact(
            RemoteBootstrapSession {
                options.run_id,
                target_identity,
                bootstrap_path,
                bootstrap_sha256,
                opus::bootstrap::kAbiVersion,
                module_handle,
            },
            &failure
        )
    ) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    RemoteBootstrapSession session;
    session.run_id = options.run_id;
    session.target = target_identity;
    session.bootstrap_path = bootstrap_path;
    session.bootstrap_sha256 = bootstrap_sha256;
    session.bootstrap_abi_version = opus::bootstrap::kAbiVersion;
    session.module_handle = module_handle;
    session.state = BootstrapSessionState::kLoaded;
    if (!write_remote_bootstrap_session(session, true, &failure)) {
        std::string rollback_failure;
        const bool rollback_succeeded = remote_dlclose_module(
            &target,
            options.pid,
            module_handle,
            "BootstrapRollback",
            &rollback_failure
        );
        (void)release_target_task(&target, nullptr);
        if (!rollback_succeeded) {
            failure += " rollback=failed";
        }
        return emit_structured_failure(failure);
    }

    if (!release_target_task(&target, &failure)) {
        return emit_structured_failure(failure);
    }
    emit(
        "BootstrapModuleLoaded",
        "pid=" + std::to_string(options.pid) +
            " target_architecture=" +
            architecture_name(target_identity.architecture) +
            " remote_session=retained"
    );
    emit(
        "BootstrapRemoteSessionRetained",
        "pid=" + std::to_string(options.pid) +
            " run_id=" + options.run_id +
            " state=loaded cleanup_owner=transport-helper"
    );
    return 0;
}

int bootstrap_resolve_remote_entrypoints(
    const BootstrapSessionOptions& options
) {
    RemoteBootstrapSession session;
    std::string failure;
    if (!read_remote_bootstrap_session(options.run_id, &session, &failure)) {
        return emit_structured_failure(failure);
    }
    if (!verify_bootstrap_session_is_active(session, &failure)) {
        return emit_structured_failure(failure);
    }

    TargetTask target;
    if (!acquire_revalidated_bootstrap_session_target(
            options.pid,
            session,
            &target,
            &failure
        )) {
        return emit_structured_failure(failure);
    }
    if (!verify_remote_bootstrap_session_artifact(session, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    mach_vm_address_t remote_dlsym = 0;
    if (!resolve_remote_symbol(target.port, "dlsym", &remote_dlsym, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "BootstrapRemoteDlsymSymbolUnavailable " + failure
        );
    }

    const std::string start_symbol = "opus_bootstrap_start";
    RemoteCallRequest start_request;
    start_request.function_address = remote_dlsym;
    start_request.argument0 = session.module_handle;
    start_request.string_argument = &start_symbol;
    start_request.string_position = RemoteStringArgument::kArgument1;
    std::uint64_t start_entrypoint = 0U;
    if (!invoke_remote_two_argument_call(
            &target,
            options.pid,
            start_request,
            "BootstrapRemoteEntrypointResolve",
            &start_entrypoint,
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (start_entrypoint == 0U) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "BootstrapEntrypointMissing pid=" +
            std::to_string(options.pid) + " required=start"
        );
    }

    const std::string stop_symbol = "opus_bootstrap_stop";
    RemoteCallRequest stop_request;
    stop_request.function_address = remote_dlsym;
    stop_request.argument0 = session.module_handle;
    stop_request.string_argument = &stop_symbol;
    stop_request.string_position = RemoteStringArgument::kArgument1;
    std::uint64_t stop_entrypoint = 0U;
    if (!invoke_remote_two_argument_call(
            &target,
            options.pid,
            stop_request,
            "BootstrapRemoteEntrypointResolve",
            &stop_entrypoint,
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (stop_entrypoint == 0U) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(
            "BootstrapEntrypointMissing pid=" +
            std::to_string(options.pid) + " required=stop"
        );
    }

    if (
        !revalidate_owned_bootstrap_fixture_target(
            options.pid,
            session.target,
            &failure
        ) ||
        !verify_remote_bootstrap_session_artifact(session, &failure)
    ) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    session.start_entrypoint = start_entrypoint;
    session.stop_entrypoint = stop_entrypoint;
    session.state = BootstrapSessionState::kEntrypointsResolved;
    if (!write_remote_bootstrap_session(session, false, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (!release_target_task(&target, &failure)) {
        return emit_structured_failure(failure);
    }

    emit(
        "BootstrapEntrypointReady",
        "pid=" + std::to_string(options.pid) +
            " run_id=" + options.run_id +
            " abi_version=" +
            std::to_string(session.bootstrap_abi_version) +
            " entrypoints=start,stop remote_session=retained"
    );
    return 0;
}

int bootstrap_cleanup_remote_module(const BootstrapSessionOptions& options) {
    RemoteBootstrapSession session;
    std::string failure;
    if (!read_remote_bootstrap_session(options.run_id, &session, &failure)) {
        return emit_structured_failure(failure);
    }
    if (!verify_bootstrap_session_is_active(session, &failure)) {
        return emit_structured_failure(failure);
    }

    TargetTask target;
    if (!acquire_revalidated_bootstrap_session_target(
            options.pid,
            session,
            &target,
            &failure
        )) {
        return emit_structured_failure(failure);
    }
    if (!verify_remote_bootstrap_session_artifact(session, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    session.state = BootstrapSessionState::kCleanupPending;
    if (!write_remote_bootstrap_session(session, false, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (!remote_dlclose_module(
            &target,
            options.pid,
            session.module_handle,
            "BootstrapRemoteCleanup",
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (
        !revalidate_owned_bootstrap_fixture_target(
            options.pid,
            session.target,
            &failure
        ) ||
        !verify_remote_bootstrap_session_artifact(session, &failure)
    ) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }

    session.module_handle = 0U;
    session.start_entrypoint = 0U;
    session.stop_entrypoint = 0U;
    session.state = BootstrapSessionState::kCleaned;
    if (!write_remote_bootstrap_session(session, false, &failure)) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (!release_target_task(&target, &failure)) {
        return emit_structured_failure(failure);
    }

    emit(
        "BootstrapCleanupReady",
        "pid=" + std::to_string(options.pid) +
            " run_id=" + options.run_id +
            " state=cleaned physical_unmapping=not_claimed"
    );
    return 0;
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

    RemoteCallRequest request;
    request.function_address = remote_dlopen;
    request.argument1 = static_cast<std::uint64_t>(
        static_cast<std::uint32_t>(RTLD_NOW | RTLD_LOCAL)
    );
    request.string_argument = &runtime_path;
    request.string_position = RemoteStringArgument::kArgument0;
    std::uint64_t module_handle = 0U;
    if (!invoke_remote_two_argument_call(
            &target,
            pid,
            request,
            "RemoteLoad",
            &module_handle,
            &failure
        )) {
        (void)release_target_task(&target, nullptr);
        return emit_structured_failure(failure);
    }
    if (!release_target_task(&target, &failure)) {
        return emit_structured_failure(failure);
    }
    if (module_handle == 0U) {
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
        << "  opus-macos-transport load --pid <current-user-pid> --runtime <absolute-dylib-path>\n"
        << "  opus-macos-transport bootstrap-load --pid <opus-task-port-probe-target-pid> --bootstrap <absolute-dylib-path> --run-id <safe-run-id>\n"
        << "  opus-macos-transport bootstrap-resolve-entrypoints --pid <opus-task-port-probe-target-pid> --run-id <safe-run-id>\n"
        << "  opus-macos-transport bootstrap-cleanup --pid <opus-task-port-probe-target-pid> --run-id <safe-run-id>\n";
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

    BootstrapLoadOptions bootstrap_load_options;
    if (
        parse_bootstrap_load_arguments(
            argc,
            argv,
            &bootstrap_load_options
        )
    ) {
        return bootstrap_load_remote_module(bootstrap_load_options);
    }

    BootstrapSessionOptions bootstrap_session_options;
    if (
        parse_bootstrap_session_arguments(
            argc,
            argv,
            "bootstrap-resolve-entrypoints",
            &bootstrap_session_options
        )
    ) {
        return bootstrap_resolve_remote_entrypoints(bootstrap_session_options);
    }
    if (
        parse_bootstrap_session_arguments(
            argc,
            argv,
            "bootstrap-cleanup",
            &bootstrap_session_options
        )
    ) {
        return bootstrap_cleanup_remote_module(bootstrap_session_options);
    }

    print_usage();
    return 2;
}
