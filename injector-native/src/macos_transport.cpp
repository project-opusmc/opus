#include <dlfcn.h>
#include <libproc.h>
#include <mach/mach.h>
#include <mach/mach_error.h>
#include <mach/mach_vm.h>
#include <mach/machine.h>
#include <mach-o/dyld_images.h>
#include <mach/task_info.h>
#if defined(__aarch64__) || defined(__arm64__)
#include <mach/arm/thread_status.h>
#elif defined(__x86_64__)
#include <mach/i386/thread_status.h>
#endif
#include <sys/proc_info.h>
#include <sys/stat.h>
#include <sys/sysctl.h>

#include <array>
#include <cerrno>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits.h>
#include <limits>
#include <string>
#include <thread>

namespace {

constexpr const char* kPrefix = "[OPUS/MACOS-TRANSPORT]";
constexpr std::size_t kRemoteDataSize = 32U * 1024U;
constexpr std::size_t kRemoteCodeSize = 16U * 1024U;
constexpr std::size_t kMaximumRemoteImageCount = 4096U;
constexpr std::size_t kMaximumRemotePathLength = 4096U;
constexpr int kLoadCompletionTimeoutMilliseconds = 5000;
constexpr int kLoadPollIntervalMilliseconds = 10;

extern "C" const unsigned char opus_remote_loader_bootstrap_start[];
extern "C" const unsigned char opus_remote_loader_bootstrap_end[];
extern "C" const unsigned char opus_remote_loader_worker_start[];
extern "C" const unsigned char opus_remote_loader_worker_end[];

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

enum class TargetArchitecture {
    kArm64,
    kX86_64,
    kUnsupported,
};

struct TargetTask {
    TargetArchitecture architecture = TargetArchitecture::kUnsupported;
    mach_port_t port = MACH_PORT_NULL;
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

bool parse_probe_arguments(int argc, char* argv[], pid_t* pid) {
    if (argc != 4 || std::strcmp(argv[1], "probe") != 0 ||
        std::strcmp(argv[2], "--pid") != 0) {
        return false;
    }
    return parse_positive_pid(argv[3], pid);
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
            " mach_error=" + std::string(mach_error_string(task_result));
        return false;
    }

    target->architecture = target_architecture;
    target->port = target_task;
    return true;
}

bool release_target_task(TargetTask* target, std::string* error) {
    if (target == nullptr || target->port == MACH_PORT_NULL) {
        return true;
    }

    const kern_return_t result =
        mach_port_deallocate(mach_task_self(), target->port);
    target->port = MACH_PORT_NULL;
    if (result == KERN_SUCCESS) {
        return true;
    }
    if (error != nullptr) {
        *error = "TaskPortReleaseFailed mach_error=" + std::string(mach_error_string(result));
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
            "RemoteMemoryReadFailed mach_error=" +
            std::string(mach_error_string(result));
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
            "RemoteMemoryWriteFailed mach_error=" +
            std::string(mach_error_string(result));
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
            "RemoteMemoryAllocateFailed mach_error=" +
            std::string(mach_error_string(result));
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
        << "  opus-macos-transport load --pid <current-user-pid> --runtime <absolute-dylib-path>\n";
}

}  // namespace

int main(int argc, char* argv[]) {
    pid_t pid = 0;
    if (parse_probe_arguments(argc, argv, &pid)) {
        return probe_task_port(pid);
    }

    std::string runtime_path;
    if (parse_load_arguments(argc, argv, &pid, &runtime_path)) {
        return load_remote_runtime(pid, runtime_path);
    }

    print_usage();
    return 2;
}
