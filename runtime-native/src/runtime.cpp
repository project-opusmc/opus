#include <jni.h>
#include <jvmti.h>

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits>
#include <map>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr const char* kRuntimeVersion = "0.1.0";
constexpr const char* kFoundationJavaRuntimeVersion = "not-built";
constexpr const char* kFoundationMappingSchemaVersion = "not-applicable";
constexpr const char* kFoundationOneConfigAdapterVersion = "not-loaded";
constexpr const char* kFoundationArtifactChecksums = "not-packaged";
constexpr const char* kAgentReadyResult = "ready";
constexpr const char* kAgentStoppedResult = "stopped";
constexpr int kProtocolVersion = 1;
constexpr const char* kNativeTransportKind = "opus-native-transport-runtime";
constexpr const char* kNativeSessionDirectoryPrefix = "/tmp/opus-injector-m3-native-";
constexpr const char* kNativeControlRequestPrefix = "OPUS_M3_RUNTIME_REQUEST ";
constexpr const char* kNativeControlResponsePrefix = "OPUS_M3_RUNTIME_RESPONSE ";
constexpr std::size_t kNativeSessionMaximumBytes = 4096U;
constexpr std::size_t kNativeControlMaximumBytes = 4096U;
constexpr int kNativeControlTimeoutSeconds = 5;
constexpr int kNativeControlBacklog = 4;

enum class RuntimePhase {
    kCold,
    kLoaded,
    kRunning,
    kStopped,
};

struct RuntimeState {
    std::mutex mutex;
    JavaVM* vm = nullptr;
    RuntimePhase phase = RuntimePhase::kCold;
    std::size_t active_operations = 0;
    std::size_t active_workers = 0;
};

RuntimeState g_runtime;
std::atomic_bool g_native_remote_worker_started {false};

struct AgentAttachOptions {
    std::string operation;
    std::string report_path;
    std::string capability;
    std::string target_architecture;
    std::string injector_version;
};

struct NativeTransportSession {
    std::uint32_t pid = 0;
    std::uint32_t owner_uid = 0;
    std::string target_architecture;
    std::string injector_version;
    std::string capability;
};

enum class NativeControlOperation {
    kHealth,
    kLoad,
    kUnload,
    kStop,
    kInvalid,
};

enum class LogLevel {
    kTrace,
    kDebug,
    kInfo,
    kWarn,
    kError,
    kFatal,
};

const char* log_level_name(LogLevel level) {
    switch (level) {
        case LogLevel::kTrace:
            return "TRACE";
        case LogLevel::kDebug:
            return "DEBUG";
        case LogLevel::kInfo:
            return "INFO";
        case LogLevel::kWarn:
            return "WARN";
        case LogLevel::kError:
            return "ERROR";
        case LogLevel::kFatal:
            return "FATAL";
    }

    return "UNKNOWN";
}

void runtime_log(const char* subsystem, LogLevel level, const std::string& message) {
    std::clog << "[OPUS/" << subsystem << "] " << log_level_name(level) << " " << message
              << '\n';
}

const char* phase_name(RuntimePhase phase) {
    switch (phase) {
        case RuntimePhase::kCold:
            return "cold";
        case RuntimePhase::kLoaded:
            return "loaded";
        case RuntimePhase::kRunning:
            return "running";
        case RuntimePhase::kStopped:
            return "stopped";
    }

    return "unknown";
}

class WorkerLease final {
public:
    WorkerLease() {
        std::lock_guard<std::mutex> lock(g_runtime.mutex);
        ++g_runtime.active_workers;
    }

    ~WorkerLease() {
        std::lock_guard<std::mutex> lock(g_runtime.mutex);
        --g_runtime.active_workers;
    }

    WorkerLease(const WorkerLease&) = delete;
    WorkerLease& operator=(const WorkerLease&) = delete;
};

class RuntimeOperationLease final {
public:
    RuntimeOperationLease() = default;

    bool acquire(JavaVM** vm, std::string* failure_reason) {
        std::lock_guard<std::mutex> lock(g_runtime.mutex);
        if (g_runtime.vm == nullptr || g_runtime.phase == RuntimePhase::kCold) {
            if (failure_reason != nullptr) {
                *failure_reason = "runtime_not_loaded";
            }
            return false;
        }

        if (g_runtime.phase == RuntimePhase::kStopped) {
            if (failure_reason != nullptr) {
                *failure_reason = "runtime_stopped";
            }
            return false;
        }

        if (vm != nullptr) {
            *vm = g_runtime.vm;
        }
        ++g_runtime.active_operations;
        acquired_ = true;
        return true;
    }

    ~RuntimeOperationLease() {
        if (!acquired_) {
            return;
        }

        std::lock_guard<std::mutex> lock(g_runtime.mutex);
        --g_runtime.active_operations;
    }

    RuntimeOperationLease(const RuntimeOperationLease&) = delete;
    RuntimeOperationLease& operator=(const RuntimeOperationLease&) = delete;

private:
    bool acquired_ = false;
};

bool verify_worker_attach_detach(JavaVM* vm, std::string* failure_reason) {
    bool succeeded = false;
    std::string worker_failure;

    std::thread worker([&] {
        WorkerLease lease;

        JNIEnv* worker_env = nullptr;
        const jint existing_env =
            vm->GetEnv(reinterpret_cast<void**>(&worker_env), JNI_VERSION_1_8);
        if (existing_env != JNI_EDETACHED) {
            worker_failure = "worker thread was unexpectedly already attached";
            return;
        }

        const jint attach_result =
            vm->AttachCurrentThread(reinterpret_cast<void**>(&worker_env), nullptr);
        if (attach_result != JNI_OK || worker_env == nullptr) {
            worker_failure = "AttachCurrentThread failed";
            return;
        }

        jclass system_class = worker_env->FindClass("java/lang/System");
        if (system_class == nullptr || worker_env->ExceptionCheck()) {
            worker_env->ExceptionClear();
            worker_failure = "attached worker could not resolve java/lang/System";
            vm->DetachCurrentThread();
            return;
        }
        worker_env->DeleteLocalRef(system_class);

        if (vm->DetachCurrentThread() != JNI_OK) {
            worker_failure = "DetachCurrentThread failed";
            return;
        }

        succeeded = true;
    });
    worker.join();

    if (!succeeded && failure_reason != nullptr) {
        *failure_reason = worker_failure;
    }
    return succeeded;
}

std::string error_probe_report(const std::string& reason) {
    std::ostringstream report;
    report << "runtime_version=" << kRuntimeVersion << ";state=error;reason=" << reason;
    return report.str();
}

const char* current_target_architecture() {
#if defined(__aarch64__) || defined(__arm64__)
    return "arm64";
#elif defined(__x86_64__)
    return "x86_64";
#else
    return "unsupported";
#endif
}

std::string sanitized_report_value(const std::string& value) {
    std::string sanitized;
    sanitized.reserve(value.size());
    for (const char character : value) {
        if (character == '\n' || character == '\r' || character == '\0') {
            sanitized.push_back(' ');
        } else {
            sanitized.push_back(character);
        }
    }
    return sanitized;
}

bool has_required_runtime_tokens(const std::string& report) {
    return report.find("vm_discovery=ok") != std::string::npos &&
           report.find("jni=ok") != std::string::npos &&
           report.find("jvmti=ok") != std::string::npos &&
           report.find("worker_attach_detach=ok") != std::string::npos &&
           report.find("state=running") != std::string::npos;
}

bool has_clean_shutdown_tokens(const std::string& report) {
    return report.find("shutdown=ok") != std::string::npos &&
           report.find("state=stopped") != std::string::npos &&
           report.find("workers=0") != std::string::npos;
}

bool is_lower_hex_capability(const std::string& capability) {
    if (capability.size() != 64U) {
        return false;
    }
    for (const char character : capability) {
        if (!((character >= '0' && character <= '9') ||
              (character >= 'a' && character <= 'f'))) {
            return false;
        }
    }
    return true;
}

int hex_value(char character) {
    if (character >= '0' && character <= '9') {
        return character - '0';
    }
    if (character >= 'a' && character <= 'f') {
        return character - 'a' + 10;
    }
    if (character >= 'A' && character <= 'F') {
        return character - 'A' + 10;
    }
    return -1;
}

bool percent_decode(const std::string& encoded, std::string* decoded) {
    if (decoded == nullptr) {
        return false;
    }

    decoded->clear();
    decoded->reserve(encoded.size());
    for (std::size_t index = 0; index < encoded.size(); ++index) {
        const char character = encoded[index];
        if (character != '%') {
            decoded->push_back(character);
            continue;
        }
        if (index + 2U >= encoded.size()) {
            return false;
        }
        const int high = hex_value(encoded[index + 1U]);
        const int low = hex_value(encoded[index + 2U]);
        if (high < 0 || low < 0) {
            return false;
        }
        const char decoded_character = static_cast<char>((high << 4) | low);
        if (decoded_character == '\0' || decoded_character == '\n' ||
            decoded_character == '\r') {
            return false;
        }
        decoded->push_back(decoded_character);
        index += 2U;
    }
    return true;
}

bool is_safe_report_path(const std::string& path) {
    if (path.empty() || path.front() != '/' || path.size() > 1024U) {
        return false;
    }
    if (path.find("/../") != std::string::npos ||
        (path.size() >= 3U && path.compare(path.size() - 3U, 3U, "/..") == 0)) {
        return false;
    }
    for (const char character : path) {
        if (character == '\0' || character == '\n' || character == '\r') {
            return false;
        }
    }
    return true;
}

bool parse_agent_attach_options(
    const char* options,
    AgentAttachOptions* parsed,
    std::string* failure_reason
) {
    if (parsed == nullptr) {
        if (failure_reason != nullptr) {
            *failure_reason = "agent_options_destination_missing";
        }
        return false;
    }
    if (options == nullptr || *options == '\0') {
        if (failure_reason != nullptr) {
            *failure_reason = "agent_options_missing";
        }
        return false;
    }

    std::map<std::string, std::string> fields;
    const std::string input(options);
    std::size_t begin = 0;
    while (begin <= input.size()) {
        const std::size_t end = input.find('&', begin);
        const std::string field = input.substr(
            begin,
            end == std::string::npos ? std::string::npos : end - begin
        );
        const std::size_t separator = field.find('=');
        if (separator == std::string::npos || separator == 0U) {
            if (failure_reason != nullptr) {
                *failure_reason = "agent_options_field_invalid";
            }
            return false;
        }
        const std::string key = field.substr(0, separator);
        std::string value;
        if (!percent_decode(field.substr(separator + 1U), &value) ||
            value.empty() || fields.find(key) != fields.end()) {
            if (failure_reason != nullptr) {
                *failure_reason = "agent_options_value_invalid";
            }
            return false;
        }
        fields.insert(std::make_pair(key, value));
        if (end == std::string::npos) {
            break;
        }
        begin = end + 1U;
    }

    if (fields.size() != 6U || fields["protocolVersion"] != "1" ||
        (fields["operation"] != "load" && fields["operation"] != "unload") ||
        !is_lower_hex_capability(fields["capability"]) ||
        (fields["targetArchitecture"] != "arm64" &&
         fields["targetArchitecture"] != "x86_64") ||
        !is_safe_report_path(fields["reportPath"]) ||
        fields["injectorVersion"].size() > 64U) {
        if (failure_reason != nullptr) {
            *failure_reason = "agent_options_contract_invalid";
        }
        return false;
    }

    parsed->operation = fields["operation"];
    parsed->report_path = fields["reportPath"];
    parsed->capability = fields["capability"];
    parsed->target_architecture = fields["targetArchitecture"];
    parsed->injector_version = fields["injectorVersion"];
    return true;
}

bool write_all(int descriptor, const std::string& contents) {
    std::size_t written = 0;
    while (written < contents.size()) {
        const ssize_t result = write(
            descriptor,
            contents.data() + written,
            contents.size() - written
        );
        if (result <= 0) {
            return false;
        }
        written += static_cast<std::size_t>(result);
    }
    return true;
}

bool is_safe_protocol_key(const std::string& key) {
    return !key.empty() &&
           std::all_of(key.begin(), key.end(), [](unsigned char character) {
               return std::isalnum(character) != 0;
           });
}

bool is_safe_protocol_token(const std::string& value) {
    return !value.empty() && value.size() <= 64U &&
           std::all_of(value.begin(), value.end(), [](unsigned char character) {
               return std::isalnum(character) != 0 || character == '-' ||
                      character == '_' || character == '.';
           });
}

bool parse_nonzero_u32(const std::string& value, std::uint32_t* parsed) {
    if (parsed == nullptr || value.empty()) {
        return false;
    }

    char* end = nullptr;
    errno = 0;
    const unsigned long candidate = std::strtoul(value.c_str(), &end, 10);
    if (
        errno != 0 || end == value.c_str() || *end != '\0' || candidate == 0UL ||
        candidate > std::numeric_limits<std::uint32_t>::max()
    ) {
        return false;
    }

    *parsed = static_cast<std::uint32_t>(candidate);
    return true;
}

bool read_private_regular_file(
    const std::string& path,
    uid_t expected_owner,
    std::size_t maximum_bytes,
    std::string* contents
) {
    if (contents == nullptr || path.empty()) {
        return false;
    }

    const int descriptor = open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (descriptor < 0) {
        return false;
    }

    struct stat metadata {};
    const bool metadata_ok = fstat(descriptor, &metadata) == 0 &&
                             S_ISREG(metadata.st_mode) &&
                             metadata.st_uid == expected_owner &&
                             (metadata.st_mode & 077) == 0 &&
                             metadata.st_nlink == 1 &&
                             metadata.st_size > 0 &&
                             static_cast<std::uintmax_t>(metadata.st_size) <= maximum_bytes;
    if (!metadata_ok) {
        close(descriptor);
        return false;
    }

    std::string value;
    value.reserve(static_cast<std::size_t>(metadata.st_size));
    std::array<char, 512> buffer {};
    bool read_ok = true;
    while (true) {
        const ssize_t result = read(descriptor, buffer.data(), buffer.size());
        if (result == 0) {
            break;
        }
        if (result < 0 || value.size() + static_cast<std::size_t>(result) > maximum_bytes) {
            read_ok = false;
            break;
        }
        value.append(buffer.data(), static_cast<std::size_t>(result));
    }
    const bool close_ok = close(descriptor) == 0;
    if (!read_ok || !close_ok || value.empty() || value.find('\0') != std::string::npos) {
        return false;
    }

    *contents = std::move(value);
    return true;
}

bool parse_properties(
    const std::string& contents,
    std::map<std::string, std::string>* fields
) {
    if (fields == nullptr || contents.empty()) {
        return false;
    }

    fields->clear();
    std::size_t begin = 0;
    while (begin < contents.size()) {
        const std::size_t end = contents.find('\n', begin);
        const std::string line = contents.substr(
            begin,
            end == std::string::npos ? std::string::npos : end - begin
        );
        if (line.empty() || line.find('\r') != std::string::npos) {
            return false;
        }
        const std::size_t separator = line.find('=');
        if (separator == std::string::npos || separator == 0U ||
            line.find('=', separator + 1U) != std::string::npos) {
            return false;
        }
        const std::string key = line.substr(0, separator);
        const std::string value = line.substr(separator + 1U);
        if (!is_safe_protocol_key(key) || value.empty() ||
            value.find_first_of("\n\r\0") != std::string::npos ||
            fields->insert(std::make_pair(key, value)).second == false) {
            return false;
        }
        if (end == std::string::npos) {
            break;
        }
        begin = end + 1U;
    }
    return !fields->empty();
}

bool is_private_session_directory(const std::string& directory, uid_t expected_owner) {
    struct stat metadata {};
    return lstat(directory.c_str(), &metadata) == 0 && S_ISDIR(metadata.st_mode) &&
           metadata.st_uid == expected_owner && (metadata.st_mode & 077) == 0;
}

std::string native_session_directory(uid_t owner_uid) {
    return std::string(kNativeSessionDirectoryPrefix) + std::to_string(owner_uid);
}

std::string native_session_path(uid_t owner_uid, pid_t pid) {
    return native_session_directory(owner_uid) + "/" + std::to_string(pid) + ".session";
}

std::string native_descriptor_path(uid_t owner_uid, pid_t pid) {
    return native_session_directory(owner_uid) + "/" + std::to_string(pid) + ".descriptor";
}

bool load_native_transport_session(NativeTransportSession* session) {
    if (session == nullptr) {
        return false;
    }

    const uid_t owner_uid = getuid();
    const pid_t current_pid = getpid();
    const std::string directory = native_session_directory(owner_uid);
    if (!is_private_session_directory(directory, owner_uid)) {
        return false;
    }

    std::string contents;
    if (!read_private_regular_file(
            native_session_path(owner_uid, current_pid),
            owner_uid,
            kNativeSessionMaximumBytes,
            &contents
        )) {
        return false;
    }

    std::map<std::string, std::string> fields;
    if (!parse_properties(contents, &fields)) {
        return false;
    }
    constexpr std::array<const char*, 11> kRequiredFields = {
        "schemaVersion",
        "pid",
        "ownerUid",
        "targetExecutable",
        "processStartTime",
        "commandFingerprint",
        "targetArchitecture",
        "runtime",
        "injectorVersion",
        "capability",
        "state",
    };
    if (
        fields.size() != kRequiredFields.size() ||
        std::any_of(fields.begin(), fields.end(), [&](const auto& field) {
            return std::none_of(
                kRequiredFields.begin(),
                kRequiredFields.end(),
                [&](const char* required) { return field.first == required; }
            );
        })
    ) {
        return false;
    }

    std::uint32_t session_pid = 0;
    std::uint32_t session_owner_uid = 0;
    if (
        fields["schemaVersion"] != "1" ||
        !parse_nonzero_u32(fields["pid"], &session_pid) ||
        !parse_nonzero_u32(fields["ownerUid"], &session_owner_uid) ||
        session_pid != static_cast<std::uint32_t>(current_pid) ||
        session_owner_uid != static_cast<std::uint32_t>(owner_uid) ||
        fields["targetArchitecture"] != current_target_architecture() ||
        !is_safe_protocol_token(fields["injectorVersion"]) ||
        !is_lower_hex_capability(fields["capability"]) ||
        fields["state"] != "load-pending" ||
        fields["targetExecutable"].empty() ||
        fields["processStartTime"].empty() ||
        fields["runtime"].empty() ||
        fields["commandFingerprint"].size() != 16U ||
        !std::all_of(
            fields["commandFingerprint"].begin(),
            fields["commandFingerprint"].end(),
            [](unsigned char character) {
                return std::isdigit(character) != 0 ||
                       (character >= static_cast<unsigned char>('a') &&
                        character <= static_cast<unsigned char>('f'));
            }
        )
    ) {
        return false;
    }

    session->pid = session_pid;
    session->owner_uid = session_owner_uid;
    session->target_architecture = fields["targetArchitecture"];
    session->injector_version = fields["injectorVersion"];
    session->capability = fields["capability"];
    return true;
}

bool write_native_descriptor(
    const NativeTransportSession& session,
    std::uint16_t port,
    const std::string& state
) {
    if (port == 0U || (state != "running" && state != "stopped")) {
        return false;
    }

    const uid_t owner_uid = static_cast<uid_t>(session.owner_uid);
    const std::string directory = native_session_directory(owner_uid);
    if (!is_private_session_directory(directory, owner_uid)) {
        return false;
    }

    const std::string descriptor_path =
        native_descriptor_path(owner_uid, static_cast<pid_t>(session.pid));
    std::string temporary_path = descriptor_path + ".tmp-XXXXXX";
    std::vector<char> temporary_template(temporary_path.begin(), temporary_path.end());
    temporary_template.push_back('\0');
    const int descriptor = mkstemp(temporary_template.data());
    if (descriptor < 0) {
        return false;
    }

    const bool permissions_ok = fchmod(descriptor, S_IRUSR | S_IWUSR) == 0;
    std::ostringstream contents;
    contents << "protocolVersion=" << kProtocolVersion
             << "\ntargetKind=" << kNativeTransportKind
             << "\npid=" << session.pid
             << "\nport=" << port
             << "\ntargetArchitecture=" << session.target_architecture
             << "\ncapability=" << session.capability
             << "\ninjectorVersion=" << session.injector_version
             << "\nnativeRuntimeVersion=" << kRuntimeVersion
             << "\njavaRuntimeVersion=" << kFoundationJavaRuntimeVersion
             << "\nmappingSchemaVersion=" << kFoundationMappingSchemaVersion
             << "\noneConfigAdapterVersion=" << kFoundationOneConfigAdapterVersion
             << "\nartifactChecksums=" << kFoundationArtifactChecksums
             << "\nstate=" << state
             << '\n';
    const bool written = permissions_ok && write_all(descriptor, contents.str());
    const bool synced = written && fsync(descriptor) == 0;
    const bool closed = close(descriptor) == 0;
    if (!written || !synced || !closed) {
        unlink(temporary_template.data());
        return false;
    }
    if (rename(temporary_template.data(), descriptor_path.c_str()) != 0) {
        unlink(temporary_template.data());
        return false;
    }
    return true;
}

void remove_native_descriptor(const NativeTransportSession& session) {
    const std::string descriptor_path = native_descriptor_path(
        static_cast<uid_t>(session.owner_uid),
        static_cast<pid_t>(session.pid)
    );
    if (unlink(descriptor_path.c_str()) != 0 && errno != ENOENT) {
        runtime_log(
            "RUNTIME",
            LogLevel::kWarn,
            "Unable to remove the native transport descriptor"
        );
    }
}

bool write_agent_report(
    const AgentAttachOptions& options,
    const std::string& result,
    const std::string& state,
    const std::string& reason
) {
    const int descriptor = open(
        options.report_path.c_str(),
        O_WRONLY | O_CREAT | O_EXCL,
        S_IRUSR | S_IWUSR
    );
    if (descriptor < 0) {
        return false;
    }

    std::ostringstream report;
    report << "protocolVersion=" << kProtocolVersion
           << "\ninjectorVersion=" << sanitized_report_value(options.injector_version)
           << "\nnativeRuntimeVersion=" << kRuntimeVersion
           << "\njavaRuntimeVersion=" << kFoundationJavaRuntimeVersion
           << "\ntargetArchitecture=" << current_target_architecture()
           << "\nmappingSchemaVersion=" << kFoundationMappingSchemaVersion
           << "\noneConfigAdapterVersion=" << kFoundationOneConfigAdapterVersion
           << "\nartifactChecksums=" << kFoundationArtifactChecksums
           << "\npid=" << getpid()
           << "\noperation=" << options.operation
           << "\nresult=" << result
           << "\nstate=" << state
           << "\ncapability=" << options.capability;
    if (!reason.empty()) {
        report << "\nreason=" << sanitized_report_value(reason);
    }
    report << '\n';

    const bool written = write_all(descriptor, report.str());
    const bool synced = written && fsync(descriptor) == 0;
    const bool closed = close(descriptor) == 0;
    return written && synced && closed;
}

bool initialize_runtime_with_vm(
    JavaVM* vm,
    const char* entry_source,
    std::string* failure_reason
) {
    if (vm == nullptr) {
        if (failure_reason != nullptr) {
            *failure_reason = "runtime_vm_missing";
        }
        return false;
    }

    std::lock_guard<std::mutex> lock(g_runtime.mutex);
    if (g_runtime.vm != nullptr && g_runtime.vm != vm) {
        if (failure_reason != nullptr) {
            *failure_reason = "runtime_vm_mismatch";
        }
        return false;
    }
    if (g_runtime.vm == nullptr) {
        g_runtime.vm = vm;
        g_runtime.phase = RuntimePhase::kLoaded;
        runtime_log(
            "RUNTIME",
            LogLevel::kInfo,
            std::string("Runtime entered through ") + entry_source
        );
    }
    return true;
}

bool initialize_agent_runtime(JavaVM* vm, std::string* failure_reason) {
    return initialize_runtime_with_vm(vm, "the test-only JVM Attach harness", failure_reason);
}

bool get_agent_environment(JavaVM* vm, JNIEnv** environment, bool* attached_here) {
    if (vm == nullptr || environment == nullptr || attached_here == nullptr) {
        return false;
    }
    *environment = nullptr;
    *attached_here = false;
    const jint existing =
        vm->GetEnv(reinterpret_cast<void**>(environment), JNI_VERSION_1_8);
    if (existing == JNI_OK && *environment != nullptr) {
        return true;
    }
    if (existing != JNI_EDETACHED) {
        return false;
    }
    if (vm->AttachCurrentThread(reinterpret_cast<void**>(environment), nullptr) != JNI_OK ||
        *environment == nullptr) {
        return false;
    }
    *attached_here = true;
    return true;
}

std::string build_probe_report(JNIEnv* env) {
    JavaVM* loaded_vm = nullptr;
    std::string lifecycle_failure;
    RuntimeOperationLease operation_lease;
    if (!operation_lease.acquire(&loaded_vm, &lifecycle_failure)) {
        runtime_log("RUNTIME", LogLevel::kError, "Probe rejected: " + lifecycle_failure);
        return error_probe_report(lifecycle_failure);
    }

    JavaVM* discovered_vms[1] = {nullptr};
    jsize vm_count = 0;
    const jint discovery_result =
        JNI_GetCreatedJavaVMs(discovered_vms, 1, &vm_count);
    const bool vm_discovery_ok =
        discovery_result == JNI_OK && vm_count == 1 && discovered_vms[0] == loaded_vm;
    runtime_log(
        "JVM",
        vm_discovery_ok ? LogLevel::kInfo : LogLevel::kError,
        vm_discovery_ok ? "Found JavaVM" : "JNI_GetCreatedJavaVMs did not return the loaded VM"
    );

    JNIEnv* current_env = nullptr;
    const bool jni_ok =
        loaded_vm->GetEnv(reinterpret_cast<void**>(&current_env), JNI_VERSION_1_8) ==
            JNI_OK &&
        current_env == env;
    runtime_log(
        "JVM",
        jni_ok ? LogLevel::kInfo : LogLevel::kError,
        jni_ok ? "JNI 1.8 ready" : "JNI 1.8 environment unavailable on caller thread"
    );

    jvmtiEnv* jvmti = nullptr;
    const bool jvmti_ok =
        loaded_vm->GetEnv(reinterpret_cast<void**>(&jvmti), JVMTI_VERSION_1_2) ==
            JNI_OK &&
        jvmti != nullptr;
    runtime_log(
        "JVMTI",
        jvmti_ok ? LogLevel::kInfo : LogLevel::kError,
        jvmti_ok ? "JVMTI ready" : "JVMTI environment unavailable"
    );

    std::string worker_failure;
    const bool worker_ok = verify_worker_attach_detach(loaded_vm, &worker_failure);
    runtime_log(
        "JVM",
        worker_ok ? LogLevel::kInfo : LogLevel::kError,
        worker_ok ? "OPUS-owned worker attached and detached"
                  : "OPUS-owned worker lifecycle failed: " + worker_failure
    );

    RuntimePhase ending_phase = RuntimePhase::kCold;
    {
        std::lock_guard<std::mutex> lock(g_runtime.mutex);
        if (g_runtime.phase == RuntimePhase::kLoaded) {
            g_runtime.phase = RuntimePhase::kRunning;
        }
        ending_phase = g_runtime.phase;
    }
    runtime_log("RUNTIME", LogLevel::kInfo, "Runtime probe complete");

    std::ostringstream report;
    report << "runtime_version=" << kRuntimeVersion
           << ";vm_discovery=" << (vm_discovery_ok ? "ok" : "error")
           << ";jni=" << (jni_ok ? "ok" : "error")
           << ";jvmti=" << (jvmti_ok ? "ok" : "error")
           << ";worker_attach_detach=" << (worker_ok ? "ok" : "error")
           << ";state=" << phase_name(ending_phase);
    if (!worker_ok) {
        report << ";worker_reason=" << worker_failure;
    }
    return report.str();
}

std::string restart_runtime(JNIEnv* env) {
    {
        std::lock_guard<std::mutex> lock(g_runtime.mutex);
        if (g_runtime.vm == nullptr || g_runtime.phase == RuntimePhase::kCold) {
            runtime_log("RUNTIME", LogLevel::kError, "Restart requested before runtime load");
            return error_probe_report("runtime_not_loaded");
        }
        if (g_runtime.phase != RuntimePhase::kStopped) {
            runtime_log("RUNTIME", LogLevel::kError, "Restart requested before runtime shutdown");
            return error_probe_report("runtime_not_stopped");
        }
        if (g_runtime.active_operations != 0U || g_runtime.active_workers != 0U) {
            runtime_log("RUNTIME", LogLevel::kWarn, "Restart deferred while runtime work is active");
            return error_probe_report("runtime_work_still_active");
        }

        g_runtime.phase = RuntimePhase::kLoaded;
    }

    runtime_log("RUNTIME", LogLevel::kInfo, "Runtime logical restart requested");
    return build_probe_report(env);
}

std::string shutdown_runtime() {
    std::lock_guard<std::mutex> lock(g_runtime.mutex);
    if (g_runtime.vm == nullptr || g_runtime.phase == RuntimePhase::kCold) {
        runtime_log("RUNTIME", LogLevel::kError, "Shutdown requested before runtime load");
        return "shutdown=error;state=cold;reason=runtime_not_loaded";
    }

    if (g_runtime.phase == RuntimePhase::kStopped) {
        runtime_log("RUNTIME", LogLevel::kDebug, "Shutdown already complete");
        return "shutdown=ok;state=stopped;workers=0";
    }

    if (g_runtime.active_operations != 0U || g_runtime.active_workers != 0U) {
        std::ostringstream report;
        report << "shutdown=error;state=" << phase_name(g_runtime.phase)
               << ";operations=" << g_runtime.active_operations
               << ";workers=" << g_runtime.active_workers;
        runtime_log("RUNTIME", LogLevel::kWarn, "Shutdown deferred while runtime work is active");
        return report.str();
    }

    g_runtime.phase = RuntimePhase::kStopped;
    runtime_log("RUNTIME", LogLevel::kInfo, "Runtime shutdown complete");
    return "shutdown=ok;state=stopped;workers=0";
}

RuntimePhase current_runtime_phase() {
    std::lock_guard<std::mutex> lock(g_runtime.mutex);
    return g_runtime.phase;
}

bool runtime_is_attached_to_vm(JavaVM* vm) {
    std::lock_guard<std::mutex> lock(g_runtime.mutex);
    return g_runtime.vm == vm && g_runtime.phase != RuntimePhase::kCold;
}

const char* native_control_operation_name(NativeControlOperation operation) {
    switch (operation) {
        case NativeControlOperation::kHealth:
            return "health";
        case NativeControlOperation::kLoad:
            return "load";
        case NativeControlOperation::kUnload:
            return "unload";
        case NativeControlOperation::kStop:
            return "stop";
        case NativeControlOperation::kInvalid:
            return "health";
    }

    return "health";
}

NativeControlOperation parse_native_control_operation(const std::string& value) {
    if (value == "health") {
        return NativeControlOperation::kHealth;
    }
    if (value == "load") {
        return NativeControlOperation::kLoad;
    }
    if (value == "unload") {
        return NativeControlOperation::kUnload;
    }
    if (value == "stop") {
        return NativeControlOperation::kStop;
    }
    return NativeControlOperation::kInvalid;
}

bool constant_time_equals(const std::string& expected, const std::string& actual) {
    if (expected.size() != actual.size()) {
        return false;
    }

    unsigned char difference = 0;
    for (std::size_t index = 0; index < expected.size(); ++index) {
        difference |= static_cast<unsigned char>(expected[index]) ^
                      static_cast<unsigned char>(actual[index]);
    }
    return difference == 0U;
}

bool parse_native_control_request(
    const std::string& line,
    const NativeTransportSession& session,
    NativeControlOperation* operation
) {
    if (operation == nullptr) {
        return false;
    }

    const std::string prefix(kNativeControlRequestPrefix);
    if (line.rfind(prefix, 0U) != 0U) {
        return false;
    }

    std::map<std::string, std::string> fields;
    const std::string payload = line.substr(prefix.size());
    std::size_t begin = 0;
    while (begin <= payload.size()) {
        const std::size_t end = payload.find(';', begin);
        const std::string field = payload.substr(
            begin,
            end == std::string::npos ? std::string::npos : end - begin
        );
        const std::size_t separator = field.find('=');
        if (separator == std::string::npos || separator == 0U ||
            field.find('=', separator + 1U) != std::string::npos) {
            return false;
        }
        const std::string key = field.substr(0, separator);
        const std::string value = field.substr(separator + 1U);
        if (!is_safe_protocol_key(key) || value.empty() ||
            fields.insert(std::make_pair(key, value)).second == false) {
            return false;
        }
        if (end == std::string::npos) {
            break;
        }
        begin = end + 1U;
    }

    constexpr std::array<const char*, 6> kRequiredFields = {
        "protocolVersion",
        "targetKind",
        "operation",
        "capability",
        "targetPid",
        "targetArchitecture",
    };
    if (
        fields.size() != kRequiredFields.size() ||
        std::any_of(fields.begin(), fields.end(), [&](const auto& field) {
            return std::none_of(
                kRequiredFields.begin(),
                kRequiredFields.end(),
                [&](const char* required) { return field.first == required; }
            );
        })
    ) {
        return false;
    }

    std::uint32_t target_pid = 0;
    if (
        fields["protocolVersion"] != "1" ||
        fields["targetKind"] != kNativeTransportKind ||
        !parse_nonzero_u32(fields["targetPid"], &target_pid) ||
        target_pid != session.pid ||
        fields["targetArchitecture"] != session.target_architecture ||
        !constant_time_equals(session.capability, fields["capability"])
    ) {
        return false;
    }

    const NativeControlOperation parsed = parse_native_control_operation(fields["operation"]);
    if (parsed == NativeControlOperation::kInvalid) {
        return false;
    }
    *operation = parsed;
    return true;
}

std::string render_native_control_response(
    const NativeTransportSession& session,
    NativeControlOperation operation,
    const std::string& code,
    const std::string& state
) {
    std::ostringstream response;
    response << kNativeControlResponsePrefix
             << "protocolVersion=" << kProtocolVersion
             << ";targetKind=" << kNativeTransportKind
             << ";operation=" << native_control_operation_name(operation)
             << ";targetPid=" << session.pid
             << ";targetArchitecture=" << session.target_architecture
             << ";code=" << code
             << ";injectorVersion=" << session.injector_version
             << ";nativeRuntimeVersion=" << kRuntimeVersion
             << ";javaRuntimeVersion=" << kFoundationJavaRuntimeVersion
             << ";mappingSchemaVersion=" << kFoundationMappingSchemaVersion
             << ";oneConfigAdapterVersion=" << kFoundationOneConfigAdapterVersion
             << ";artifactChecksums=" << kFoundationArtifactChecksums
             << ";state=" << state
             << '\n';
    return response.str();
}

bool configure_native_control_socket(int descriptor) {
    const timeval timeout {
        kNativeControlTimeoutSeconds,
        0,
    };
    return setsockopt(
               descriptor,
               SOL_SOCKET,
               SO_RCVTIMEO,
               &timeout,
               static_cast<socklen_t>(sizeof(timeout))
           ) == 0 &&
           setsockopt(
               descriptor,
               SOL_SOCKET,
               SO_SNDTIMEO,
               &timeout,
               static_cast<socklen_t>(sizeof(timeout))
           ) == 0;
}

bool read_native_control_line(int descriptor, std::string* line) {
    if (line == nullptr) {
        return false;
    }

    line->clear();
    while (line->size() < kNativeControlMaximumBytes) {
        char character = '\0';
        const ssize_t read_result = recv(descriptor, &character, 1U, 0);
        if (read_result != 1) {
            return false;
        }
        if (character == '\n') {
            return !line->empty();
        }
        if (character == '\r' || character == '\0') {
            return false;
        }
        line->push_back(character);
    }
    return false;
}

int create_native_control_listener(std::uint16_t* port) {
    if (port == nullptr) {
        return -1;
    }

    const int descriptor = socket(AF_INET, SOCK_STREAM, 0);
    if (descriptor < 0) {
        return -1;
    }

    const int reuse_address = 1;
    if (
        setsockopt(
            descriptor,
            SOL_SOCKET,
            SO_REUSEADDR,
            &reuse_address,
            static_cast<socklen_t>(sizeof(reuse_address))
        ) != 0
    ) {
        close(descriptor);
        return -1;
    }

    sockaddr_in address {};
    address.sin_family = AF_INET;
    address.sin_port = 0;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (
        bind(
            descriptor,
            reinterpret_cast<const sockaddr*>(&address),
            static_cast<socklen_t>(sizeof(address))
        ) != 0 ||
        listen(descriptor, kNativeControlBacklog) != 0
    ) {
        close(descriptor);
        return -1;
    }

    sockaddr_in bound_address {};
    socklen_t bound_address_size = static_cast<socklen_t>(sizeof(bound_address));
    if (
        getsockname(
            descriptor,
            reinterpret_cast<sockaddr*>(&bound_address),
            &bound_address_size
        ) != 0 ||
        bound_address.sin_family != AF_INET ||
        ntohs(bound_address.sin_port) == 0U
    ) {
        close(descriptor);
        return -1;
    }

    *port = ntohs(bound_address.sin_port);
    return descriptor;
}

bool start_remote_runtime(
    const NativeTransportSession& session,
    std::string* failure_reason
) {
    WorkerLease worker_lease;

    if (session.target_architecture != current_target_architecture()) {
        if (failure_reason != nullptr) {
            *failure_reason = "remote_target_architecture_mismatch";
        }
        return false;
    }

    JavaVM* discovered_vms[1] = {nullptr};
    jsize vm_count = 0;
    const jint discovery_result =
        JNI_GetCreatedJavaVMs(discovered_vms, 1, &vm_count);
    if (discovery_result != JNI_OK || vm_count != 1 || discovered_vms[0] == nullptr) {
        if (failure_reason != nullptr) {
            *failure_reason = "remote_jvm_discovery_failed";
        }
        return false;
    }

    JavaVM* vm = discovered_vms[0];
    if (!initialize_runtime_with_vm(vm, "the native transport session", failure_reason)) {
        return false;
    }

    bool attached_here = false;
    JNIEnv* environment = nullptr;
    if (!get_agent_environment(vm, &environment, &attached_here)) {
        if (failure_reason != nullptr) {
            *failure_reason = "remote_jni_environment_unavailable";
        }
        return false;
    }

    std::string report;
    const RuntimePhase phase = current_runtime_phase();
    if (phase == RuntimePhase::kStopped) {
        report = restart_runtime(environment);
    } else if (phase == RuntimePhase::kRunning) {
        if (failure_reason != nullptr) {
            *failure_reason = "remote_runtime_already_running";
        }
    } else {
        report = build_probe_report(environment);
    }

    if (attached_here && vm->DetachCurrentThread() != JNI_OK && failure_reason != nullptr &&
        failure_reason->empty()) {
        *failure_reason = "remote_jni_detach_failed";
    }
    if (failure_reason != nullptr && !failure_reason->empty()) {
        return false;
    }
    if (!has_required_runtime_tokens(report)) {
        if (failure_reason != nullptr) {
            *failure_reason = "remote_runtime_entry_failed";
        }
        return false;
    }

    return true;
}

struct NativeControlResult {
    std::string code;
    std::string state;
    bool stop_server = false;
};

NativeControlResult handle_native_control_operation(
    const NativeTransportSession& session,
    NativeControlOperation operation,
    std::uint16_t port
) {
    const auto current_state = [] {
        return std::string(phase_name(current_runtime_phase()));
    };

    switch (operation) {
        case NativeControlOperation::kHealth:
            return {
                "TargetAlive",
                current_state(),
                false,
            };
        case NativeControlOperation::kUnload: {
            if (current_runtime_phase() == RuntimePhase::kStopped) {
                return {
                    "RuntimeNotRunning",
                    "stopped",
                    false,
                };
            }
            const std::string report = shutdown_runtime();
            if (!has_clean_shutdown_tokens(report)) {
                return {
                    "NativeShutdownFailed",
                    current_state(),
                    false,
                };
            }
            if (!write_native_descriptor(session, port, "stopped")) {
                return {
                    "DescriptorPublishFailed",
                    "stopped",
                    false,
                };
            }
            return {
                "Stopped",
                "stopped",
                false,
            };
        }
        case NativeControlOperation::kLoad: {
            if (current_runtime_phase() != RuntimePhase::kStopped) {
                return {
                    "RuntimeAlreadyRunning",
                    current_state(),
                    false,
                };
            }

            JavaVM* vm = nullptr;
            {
                std::lock_guard<std::mutex> lock(g_runtime.mutex);
                vm = g_runtime.vm;
            }
            bool attached_here = false;
            JNIEnv* environment = nullptr;
            if (vm == nullptr || !get_agent_environment(vm, &environment, &attached_here)) {
                return {
                    "NativeEntryFailed",
                    current_state(),
                    false,
                };
            }
            const std::string report = restart_runtime(environment);
            const bool detached =
                !attached_here || vm->DetachCurrentThread() == JNI_OK;
            if (!detached || !has_required_runtime_tokens(report)) {
                return {
                    "NativeEntryFailed",
                    current_state(),
                    false,
                };
            }
            if (!write_native_descriptor(session, port, "running")) {
                return {
                    "DescriptorPublishFailed",
                    "running",
                    false,
                };
            }
            return {
                "Ready",
                "running",
                false,
            };
        }
        case NativeControlOperation::kStop:
            if (current_runtime_phase() != RuntimePhase::kStopped) {
                return {
                    "RuntimeNotStopped",
                    current_state(),
                    false,
                };
            }
            return {
                "ControlStopped",
                "stopped",
                true,
            };
        case NativeControlOperation::kInvalid:
            return {
                "InvalidRequest",
                current_state(),
                false,
            };
    }

    return {
        "InvalidRequest",
        current_state(),
        false,
    };
}

bool handle_native_control_connection(
    int descriptor,
    const NativeTransportSession& session,
    std::uint16_t port,
    bool* stop_server
) {
    if (stop_server == nullptr || !configure_native_control_socket(descriptor)) {
        return false;
    }

    std::string line;
    NativeControlOperation operation = NativeControlOperation::kInvalid;
    const bool parsed =
        read_native_control_line(descriptor, &line) &&
        parse_native_control_request(line, session, &operation);
    const NativeControlResult result = parsed
        ? handle_native_control_operation(session, operation, port)
        : handle_native_control_operation(
              session,
              NativeControlOperation::kInvalid,
              port
          );
    const std::string response = render_native_control_response(
        session,
        operation,
        result.code,
        result.state
    );
    const bool sent = write_all(descriptor, response);
    if (sent && result.stop_server) {
        *stop_server = true;
    }
    return sent;
}

void run_native_control_server(
    const NativeTransportSession& session,
    int listener,
    std::uint16_t port
) {
    bool stop_server = false;
    while (!stop_server) {
        const int client = accept(listener, nullptr, nullptr);
        if (client < 0) {
            if (errno == EINTR) {
                continue;
            }
            runtime_log("RUNTIME", LogLevel::kWarn, "Native transport control listener stopped");
            break;
        }
        const bool handled =
            handle_native_control_connection(client, session, port, &stop_server);
        close(client);
        if (!handled) {
            runtime_log(
                "RUNTIME",
                LogLevel::kWarn,
                "Native transport control request was rejected"
            );
        }
    }
    close(listener);
    remove_native_descriptor(session);
    runtime_log("RUNTIME", LogLevel::kInfo, "Native transport control endpoint stopped");
}

void run_native_remote_worker(NativeTransportSession session) {
    std::string failure_reason;
    if (!start_remote_runtime(session, &failure_reason)) {
        runtime_log(
            "RUNTIME",
            LogLevel::kError,
            "Native transport runtime entry failed: " + failure_reason
        );
        return;
    }

    std::uint16_t port = 0;
    const int listener = create_native_control_listener(&port);
    if (listener < 0) {
        runtime_log(
            "RUNTIME",
            LogLevel::kError,
            "Native transport could not bind its loopback control endpoint"
        );
        return;
    }
    if (!write_native_descriptor(session, port, "running")) {
        close(listener);
        runtime_log(
            "RUNTIME",
            LogLevel::kError,
            "Native transport could not publish its runtime descriptor"
        );
        return;
    }

    runtime_log(
        "RUNTIME",
        LogLevel::kInfo,
        "Native transport runtime entry and handshake are ready"
    );
    run_native_control_server(session, listener, port);
}

void start_native_remote_worker_from_constructor() {
    NativeTransportSession session;
    if (!load_native_transport_session(&session)) {
        return;
    }

    bool expected = false;
    if (!g_native_remote_worker_started.compare_exchange_strong(expected, true)) {
        return;
    }
    try {
        std::thread(run_native_remote_worker, std::move(session)).detach();
    } catch (const std::exception&) {
        runtime_log(
            "RUNTIME",
            LogLevel::kError,
            "Native transport could not start its post-load worker"
        );
    }
}

jint handle_agent_attach(JavaVM* vm, char* options) {
    AgentAttachOptions parsed;
    std::string failure_reason;
    if (!parse_agent_attach_options(options, &parsed, &failure_reason)) {
        runtime_log(
            "RUNTIME",
            LogLevel::kError,
            "Test-only JVM Attach harness request rejected: " + failure_reason
        );
        return JNI_ERR;
    }

    if (parsed.target_architecture != current_target_architecture()) {
        failure_reason = "agent_target_architecture_mismatch";
    } else if (parsed.operation == "unload" && !runtime_is_attached_to_vm(vm)) {
        failure_reason = "runtime_not_loaded";
    } else {
        bool attached_here = false;
        JNIEnv* environment = nullptr;
        std::string runtime_report;
        if (parsed.operation == "load") {
            if (!initialize_agent_runtime(vm, &failure_reason)) {
                runtime_log(
                    "RUNTIME",
                    LogLevel::kError,
                    "Test-only JVM Attach harness load rejected: " + failure_reason
                );
            } else if (!get_agent_environment(vm, &environment, &attached_here)) {
                failure_reason = "agent_jni_environment_unavailable";
            } else {
                const RuntimePhase phase = current_runtime_phase();
                if (phase == RuntimePhase::kRunning) {
                    failure_reason = "runtime_already_running";
                } else if (phase == RuntimePhase::kStopped) {
                    runtime_report = restart_runtime(environment);
                } else {
                    runtime_report = build_probe_report(environment);
                }
                if (failure_reason.empty() && !has_required_runtime_tokens(runtime_report)) {
                    failure_reason = "runtime_entry_failed:" + runtime_report;
                }
            }
        } else {
            runtime_report = shutdown_runtime();
            if (!has_clean_shutdown_tokens(runtime_report)) {
                failure_reason = "runtime_shutdown_failed:" + runtime_report;
            }
        }

        if (attached_here && vm->DetachCurrentThread() != JNI_OK &&
            failure_reason.empty()) {
            failure_reason = "agent_jni_detach_failed";
        }
    }

    const bool succeeded = failure_reason.empty();
    const RuntimePhase phase = current_runtime_phase();
    const std::string state = phase_name(phase);
    const std::string result =
        succeeded ? (parsed.operation == "load" ? kAgentReadyResult : kAgentStoppedResult)
                  : "error";
    if (!write_agent_report(parsed, result, state, failure_reason)) {
        runtime_log(
            "RUNTIME",
            LogLevel::kError,
            "Test-only JVM Attach harness request could not publish its report"
        );
        return JNI_ERR;
    }

    runtime_log(
        "RUNTIME",
        succeeded ? LogLevel::kInfo : LogLevel::kError,
        succeeded ? "Test-only JVM Attach harness lifecycle request completed"
                  : "Test-only JVM Attach harness lifecycle request failed: " + failure_reason
    );
    return succeeded ? JNI_OK : JNI_ERR;
}

jstring java_string(JNIEnv* env, const std::string& value) {
    return env->NewStringUTF(value.c_str());
}

}  // namespace

__attribute__((constructor))
static void opus_runtime_native_transport_constructor() {
    start_native_remote_worker_from_constructor();
}

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    if (vm == nullptr) {
        return JNI_ERR;
    }

    std::lock_guard<std::mutex> lock(g_runtime.mutex);
    g_runtime.vm = vm;
    g_runtime.phase = RuntimePhase::kLoaded;
    g_runtime.active_operations = 0;
    g_runtime.active_workers = 0;
    runtime_log("RUNTIME", LogLevel::kInfo, "Runtime loaded");
    return JNI_VERSION_1_8;
}

extern "C" JNIEXPORT void JNICALL JNI_OnUnload(JavaVM*, void*) {
    std::lock_guard<std::mutex> lock(g_runtime.mutex);
    g_runtime.vm = nullptr;
    g_runtime.phase = RuntimePhase::kCold;
    g_runtime.active_operations = 0;
    g_runtime.active_workers = 0;
    runtime_log("RUNTIME", LogLevel::kInfo, "Runtime unloaded");
}

extern "C" JNIEXPORT jint JNICALL Agent_OnAttach(JavaVM* vm, char* options, void*) {
    // The JDK invokes this entry only in the source-controlled Attach harness.
    // Production transport must use the separately reviewed native path.
    return handle_agent_attach(vm, options);
}

extern "C" JNIEXPORT jstring JNICALL
Java_dev_opus_runtime_bridge_NativeRuntimeBridge_probe(JNIEnv* env, jclass) {
    return java_string(env, build_probe_report(env));
}

extern "C" JNIEXPORT jstring JNICALL
Java_dev_opus_runtime_bridge_NativeRuntimeBridge_shutdown(JNIEnv* env, jclass) {
    return java_string(env, shutdown_runtime());
}

extern "C" JNIEXPORT jstring JNICALL
Java_dev_opus_runtime_bridge_NativeRuntimeBridge_restart(JNIEnv* env, jclass) {
    return java_string(env, restart_runtime(env));
}
