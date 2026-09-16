#include "opus_bootstrap_protocol.hpp"

#include <CommonCrypto/CommonDigest.h>

#include <dlfcn.h>

#include <array>
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <string_view>

namespace {

#if defined(__arm64__)
constexpr const char kHostArchitecture[] = "arm64";
#elif defined(__x86_64__)
constexpr const char kHostArchitecture[] = "x86_64";
#else
constexpr const char kHostArchitecture[] = "unsupported";
#endif

constexpr std::uint32_t kMinimumIterations = 1U;
constexpr std::uint32_t kMaximumIterations = 25U;

struct Options {
    std::string bootstrap_path;
    std::string expected_bootstrap_sha256;
    std::string observed_bootstrap_sha256;
    std::uint32_t iterations = 0U;
    std::uint64_t session_nonce = 0U;
    std::string run_id;
    std::string events_path;
};

struct CycleFailure {
    std::string code;
    std::string detail;
    bool cleanup_complete = false;
};

std::string json_escape(std::string_view value) {
    std::string escaped;
    escaped.reserve(value.size());
    for (const char character : value) {
        switch (character) {
            case '\\':
                escaped += "\\\\";
                break;
            case '"':
                escaped += "\\\"";
                break;
            case '\n':
                escaped += "\\n";
                break;
            case '\r':
                escaped += "\\r";
                break;
            case '\t':
                escaped += "\\t";
                break;
            default:
                if (static_cast<unsigned char>(character) < 0x20U) {
                    escaped += "\\u00";
                    constexpr char kHexDigits[] = "0123456789abcdef";
                    escaped += kHexDigits[
                        (static_cast<unsigned char>(character) >> 4U) & 0x0fU
                    ];
                    escaped += kHexDigits[
                        static_cast<unsigned char>(character) & 0x0fU
                    ];
                } else {
                    escaped += character;
                }
        }
    }
    return escaped;
}

std::string line_value(std::string_view value) {
    std::string sanitized;
    sanitized.reserve(value.size());
    for (const char character : value) {
        sanitized +=
            (character == ' ' || character == '\n' || character == '\r' ||
                character == '\t')
            ? '_'
            : character;
    }
    return sanitized;
}

std::string hexadecimal(std::uint64_t value) {
    std::ostringstream output;
    output << "0x" << std::hex << std::nouppercase << std::setw(16)
           << std::setfill('0') << value;
    return output.str();
}

bool parse_u32(const char* value, std::uint32_t* output) {
    if (value == nullptr || output == nullptr) {
        return false;
    }
    errno = 0;
    char* end = nullptr;
    const unsigned long parsed = std::strtoul(value, &end, 10);
    if (
        errno != 0 || end == value || *end != '\0' ||
        parsed > std::numeric_limits<std::uint32_t>::max()
    ) {
        return false;
    }
    *output = static_cast<std::uint32_t>(parsed);
    return true;
}

bool parse_u64(const char* value, std::uint64_t* output) {
    if (value == nullptr || output == nullptr) {
        return false;
    }
    errno = 0;
    char* end = nullptr;
    const unsigned long long parsed = std::strtoull(value, &end, 0);
    if (errno != 0 || end == value || *end != '\0') {
        return false;
    }
    *output = static_cast<std::uint64_t>(parsed);
    return true;
}

bool is_lowercase_sha256(std::string_view value) {
    if (value.size() != CC_SHA256_DIGEST_LENGTH * 2U) {
        return false;
    }
    for (const char character : value) {
        if (
            (character < '0' || character > '9') &&
            (character < 'a' || character > 'f')
        ) {
            return false;
        }
    }
    return true;
}

bool parse_options(int argc, char* argv[], Options* options) {
    if (options == nullptr) {
        return false;
    }
    for (int index = 1; index < argc; ++index) {
        const std::string argument(argv[index]);
        if (
            argument != "--bootstrap" &&
            argument != "--bootstrap-sha256" &&
            argument != "--iterations" &&
            argument != "--session-nonce" &&
            argument != "--run-id" &&
            argument != "--events-file"
        ) {
            return false;
        }
        if (index + 1 >= argc) {
            return false;
        }
        const char* value = argv[++index];
        if (argument == "--bootstrap") {
            options->bootstrap_path = value;
            continue;
        }
        if (argument == "--bootstrap-sha256") {
            options->expected_bootstrap_sha256 = value;
            continue;
        }
        if (argument == "--iterations") {
            if (!parse_u32(value, &options->iterations)) {
                return false;
            }
            continue;
        }
        if (argument == "--session-nonce") {
            if (!parse_u64(value, &options->session_nonce)) {
                return false;
            }
            continue;
        }
        if (argument == "--run-id") {
            options->run_id = value;
            continue;
        }
        options->events_path = value;
    }
    return
        !options->bootstrap_path.empty() &&
        is_lowercase_sha256(options->expected_bootstrap_sha256) &&
        options->iterations >= kMinimumIterations &&
        options->iterations <= kMaximumIterations &&
        options->session_nonce != 0U && !options->run_id.empty() &&
        !options->events_path.empty();
}

bool sha256_for_file(
    const std::string& path,
    std::string* digest,
    std::string* detail
) {
    if (digest == nullptr || detail == nullptr) {
        return false;
    }

    std::ifstream input(path, std::ios::binary);
    if (!input.is_open()) {
        *detail = "could not open bootstrap artifact for SHA-256";
        return false;
    }

    CC_SHA256_CTX context;
    CC_SHA256_Init(&context);
    std::array<char, 4096U> buffer {};
    while (input.good()) {
        input.read(
            buffer.data(),
            static_cast<std::streamsize>(buffer.size())
        );
        const std::streamsize bytes_read = input.gcount();
        if (bytes_read > 0) {
            CC_SHA256_Update(
                &context,
                buffer.data(),
                static_cast<CC_LONG>(bytes_read)
            );
        }
    }
    if (!input.eof()) {
        *detail = "could not read bootstrap artifact for SHA-256";
        return false;
    }

    std::array<unsigned char, CC_SHA256_DIGEST_LENGTH> raw_digest {};
    CC_SHA256_Final(raw_digest.data(), &context);
    constexpr char kHexDigits[] = "0123456789abcdef";
    std::string hexadecimal_digest;
    hexadecimal_digest.reserve(raw_digest.size() * 2U);
    for (const unsigned char byte : raw_digest) {
        hexadecimal_digest += kHexDigits[(byte >> 4U) & 0x0fU];
        hexadecimal_digest += kHexDigits[byte & 0x0fU];
    }
    *digest = hexadecimal_digest;
    return true;
}

bool canonical_existing_path(
    const std::string& input,
    std::string* canonical_path
) {
    if (canonical_path == nullptr) {
        return false;
    }
    const std::filesystem::path path(input);
    if (!path.is_absolute()) {
        return false;
    }
    std::error_code error;
    const std::filesystem::path canonical =
        std::filesystem::canonical(path, error);
    if (error || !std::filesystem::is_regular_file(canonical, error)) {
        return false;
    }
    *canonical_path = canonical.string();
    return true;
}

bool is_writable_events_path(const std::string& input) {
    const std::filesystem::path path(input);
    if (!path.is_absolute() || path.filename().empty()) {
        return false;
    }
    std::error_code error;
    return std::filesystem::is_directory(path.parent_path(), error) && !error;
}

class EventWriter {
  public:
    explicit EventWriter(const std::string& path)
        : stream_(path, std::ios::out | std::ios::app) {}

    bool is_open() const {
        return stream_.is_open() && stream_.good();
    }

    bool emit(
        const Options& options,
        std::uint32_t iteration,
        std::string_view event,
        std::string_view outcome,
        const opus::bootstrap::ControlBlock* control,
        bool cleanup_complete
    ) {
        if (!is_open()) {
            return false;
        }
        const std::uint64_t session_nonce =
            control == nullptr ? 0U : control->session_nonce;
        const std::uint64_t expected_handshake =
            control == nullptr ? 0U : control->expected_handshake;
        const std::uint64_t observed_handshake =
            control == nullptr ? 0U : control->observed_handshake;
        const std::uint64_t stop_acknowledgement =
            control == nullptr ? 0U : control->stop_acknowledgement;
        const std::uint64_t cleanup_acknowledgement =
            control == nullptr ? 0U : control->cleanup_acknowledgement;
        stream_ << "{\"schema\":\"opus.m3.gate6.lifecycle.v1\""
                << ",\"run_id\":\"" << json_escape(options.run_id) << "\""
                << ",\"sequence\":" << ++sequence_
                << ",\"iteration\":" << iteration
                << ",\"iterations_requested\":" << options.iterations
                << ",\"event\":\"" << json_escape(event) << "\""
                << ",\"outcome\":\"" << json_escape(outcome) << "\""
                << ",\"architecture\":\"" << kHostArchitecture << "\""
                << ",\"bootstrap_path\":\""
                << json_escape(options.bootstrap_path) << "\""
                << ",\"expected_bootstrap_sha256\":\""
                << json_escape(options.expected_bootstrap_sha256) << "\""
                << ",\"observed_bootstrap_sha256\":\""
                << json_escape(options.observed_bootstrap_sha256) << "\""
                << ",\"session_nonce\":\"" << hexadecimal(session_nonce)
                << "\""
                << ",\"expected_handshake\":\""
                << hexadecimal(expected_handshake) << "\""
                << ",\"observed_handshake\":\""
                << hexadecimal(observed_handshake) << "\""
                << ",\"stop_acknowledgement\":\""
                << hexadecimal(stop_acknowledgement) << "\""
                << ",\"cleanup_acknowledgement\":\""
                << hexadecimal(cleanup_acknowledgement) << "\""
                << ",\"cleanup_complete\":"
                << (cleanup_complete ? "true" : "false") << "}\n";
        stream_.flush();
        return stream_.good();
    }

  private:
    std::ofstream stream_;
    std::uint64_t sequence_ = 0U;
};

opus::bootstrap::ControlBlock control_for(
    std::uint64_t session_nonce,
    opus::bootstrap::Action action
) {
    opus::bootstrap::ControlBlock control;
    control.session_nonce = session_nonce;
    control.requested_action = static_cast<std::uint32_t>(action);
    control.expected_handshake = opus::bootstrap::handshake_for(
        session_nonce,
        control.abi_version
    );
    return control;
}

const char* failure_code_for_status(
    opus::bootstrap::Status status,
    bool during_stop
) {
    switch (status) {
        case opus::bootstrap::Status::UnsupportedAbi:
            return "BootstrapAbiUnsupported";
        case opus::bootstrap::Status::InvalidHandshake:
            return "BootstrapHandshakeInvalid";
        case opus::bootstrap::Status::SessionMismatch:
            return "BootstrapNonceMismatch";
        case opus::bootstrap::Status::InvalidAction:
            return during_stop ? "BootstrapStopFailed" : "BootstrapStartFailed";
        case opus::bootstrap::Status::AlreadyActive:
            return "BootstrapStartFailed";
        case opus::bootstrap::Status::NotActive:
            return "BootstrapStopFailed";
        case opus::bootstrap::Status::InvalidControlBlock:
            return "BootstrapArtifactInvalid";
        case opus::bootstrap::Status::Ok:
            return during_stop ? "BootstrapStopFailed" : "BootstrapStartFailed";
    }
    return during_stop ? "BootstrapStopFailed" : "BootstrapStartFailed";
}

bool control_matches_started(
    const opus::bootstrap::ControlBlock& control
) {
    return
        control.status == static_cast<std::uint32_t>(opus::bootstrap::Status::Ok) &&
        control.observed_state ==
            static_cast<std::uint32_t>(opus::bootstrap::State::Started) &&
        control.observed_handshake == control.expected_handshake;
}

bool control_matches_stopped(
    const opus::bootstrap::ControlBlock& control
) {
    return
        control.status == static_cast<std::uint32_t>(opus::bootstrap::Status::Ok) &&
        control.observed_state ==
            static_cast<std::uint32_t>(opus::bootstrap::State::CleanedUp) &&
        control.observed_handshake == control.expected_handshake &&
        control.stop_acknowledgement ==
            opus::bootstrap::stop_acknowledgement_for(
                control.session_nonce,
                control.abi_version
            ) &&
        control.cleanup_acknowledgement ==
            opus::bootstrap::cleanup_acknowledgement_for(
                control.session_nonce,
                control.abi_version
            );
}

bool close_module(void** module, std::string* detail) {
    if (module == nullptr || *module == nullptr) {
        return true;
    }
    if (dlclose(*module) != 0) {
        if (detail != nullptr) {
            const char* error = dlerror();
            *detail = error == nullptr ? "dlclose failed" : error;
        }
        return false;
    }
    *module = nullptr;
    return true;
}

bool stop_after_failed_observation(
    opus::bootstrap::Entrypoint stop,
    std::uint64_t session_nonce
) {
    if (stop == nullptr) {
        return false;
    }
    opus::bootstrap::ControlBlock cleanup_control =
        control_for(session_nonce, opus::bootstrap::Action::Stop);
    const auto result = static_cast<opus::bootstrap::Status>(
        stop(&cleanup_control)
    );
    return result == opus::bootstrap::Status::Ok &&
        control_matches_stopped(cleanup_control);
}

bool run_cycle(
    const Options& options,
    EventWriter* events,
    std::uint32_t iteration,
    CycleFailure* failure,
    opus::bootstrap::ControlBlock* completed_control
) {
    if (events == nullptr || failure == nullptr || completed_control == nullptr) {
        return false;
    }

    const std::uint64_t session_nonce =
        options.session_nonce + static_cast<std::uint64_t>(iteration - 1U);
    if (session_nonce == 0U) {
        failure->code = "BootstrapNonceMismatch";
        failure->detail = "session nonce overflowed to zero";
        return false;
    }

    opus::bootstrap::ControlBlock control =
        control_for(session_nonce, opus::bootstrap::Action::Start);
    if (!events->emit(
            options,
            iteration,
            "ArtifactVerified",
            "Success",
            &control,
            false
        )) {
        failure->code = "BootstrapEvidenceMissing";
        failure->detail = "could not write ArtifactVerified event";
        return false;
    }

    void* module = dlopen(options.bootstrap_path.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (module == nullptr) {
        const char* error = dlerror();
        failure->code = "BootstrapArtifactInvalid";
        failure->detail = error == nullptr ? "dlopen failed" : error;
        (void)events->emit(
            options,
            iteration,
            "BootstrapCleanupRequired",
            failure->code,
            &control,
            false
        );
        return false;
    }
    if (!events->emit(
            options,
            iteration,
            "BootstrapModuleLoaded",
            "Success",
            &control,
            false
        )) {
        std::string cleanup_detail;
        failure->cleanup_complete = close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? "could not write BootstrapModuleLoaded event"
            : cleanup_detail;
        return false;
    }

    dlerror();
    const auto start = reinterpret_cast<opus::bootstrap::Entrypoint>(
        dlsym(module, "opus_bootstrap_start")
    );
    const char* start_lookup_error_value = dlerror();
    const std::string start_lookup_error =
        start_lookup_error_value == nullptr ? "" : start_lookup_error_value;
    dlerror();
    const auto stop = reinterpret_cast<opus::bootstrap::Entrypoint>(
        dlsym(module, "opus_bootstrap_stop")
    );
    const char* stop_lookup_error_value = dlerror();
    const std::string stop_lookup_error =
        stop_lookup_error_value == nullptr ? "" : stop_lookup_error_value;
    if (!start_lookup_error.empty() || !stop_lookup_error.empty()) {
        std::string cleanup_detail;
        failure->cleanup_complete = close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? "BootstrapEntrypointMissing"
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? (!start_lookup_error.empty()
                ? start_lookup_error
                : stop_lookup_error)
            : cleanup_detail;
        (void)events->emit(
            options,
            iteration,
            "BootstrapCleanupRequired",
            failure->code,
            &control,
            failure->cleanup_complete
        );
        return false;
    }
    if (!events->emit(
            options,
            iteration,
            "BootstrapEntrypointReady",
            "Success",
            &control,
            false
        )) {
        std::string cleanup_detail;
        failure->cleanup_complete = close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? "could not write BootstrapEntrypointReady event"
            : cleanup_detail;
        return false;
    }

    if (!events->emit(
            options,
            iteration,
            "BootstrapStartPending",
            "Success",
            &control,
            false
        )) {
        std::string cleanup_detail;
        failure->cleanup_complete = close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? "could not write BootstrapStartPending event"
            : cleanup_detail;
        return false;
    }

    const auto start_result =
        static_cast<opus::bootstrap::Status>(start(&control));
    if (start_result != opus::bootstrap::Status::Ok || !control_matches_started(control)) {
        const bool start_may_be_active =
            start_result == opus::bootstrap::Status::Ok;
        const bool stopped = !start_may_be_active ||
            stop_after_failed_observation(stop, session_nonce);
        std::string cleanup_detail;
        failure->cleanup_complete = stopped && close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? (start_may_be_active
                ? "BootstrapHandshakeInvalid"
                : failure_code_for_status(start_result, false))
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? (start_may_be_active
                ? "start acknowledgement did not match the control block"
                : opus::bootstrap::status_name(start_result))
            : (stopped ? cleanup_detail : "logical stop acknowledgement failed");
        (void)events->emit(
            options,
            iteration,
            "BootstrapCleanupRequired",
            failure->code,
            &control,
            failure->cleanup_complete
        );
        return false;
    }
    if (!events->emit(
            options,
            iteration,
            "BootstrapStarted",
            "Success",
            &control,
            false
        )) {
        const bool stopped = stop_after_failed_observation(stop, session_nonce);
        std::string cleanup_detail;
        const bool unloaded = stopped && close_module(&module, &cleanup_detail);
        failure->cleanup_complete = unloaded;
        failure->code = unloaded
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = unloaded
            ? "could not write BootstrapStarted event"
            : (stopped ? cleanup_detail : "logical stop acknowledgement failed");
        return false;
    }
    if (!events->emit(
            options,
            iteration,
            "BootstrapHandshakeOk",
            "Success",
            &control,
            false
        )) {
        const bool stopped = stop_after_failed_observation(stop, session_nonce);
        std::string cleanup_detail;
        const bool unloaded = stopped && close_module(&module, &cleanup_detail);
        failure->cleanup_complete = unloaded;
        failure->code = unloaded
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = unloaded
            ? "could not write BootstrapHandshakeOk event"
            : (stopped ? cleanup_detail : "logical stop acknowledgement failed");
        return false;
    }
    if (!events->emit(
            options,
            iteration,
            "BootstrapLoadObserved",
            "Success",
            &control,
            false
        )) {
        const bool stopped = stop_after_failed_observation(stop, session_nonce);
        std::string cleanup_detail;
        const bool unloaded = stopped && close_module(&module, &cleanup_detail);
        failure->cleanup_complete = unloaded;
        failure->code = unloaded
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = unloaded
            ? "could not write BootstrapLoadObserved event"
            : (stopped ? cleanup_detail : "logical stop acknowledgement failed");
        return false;
    }

    control.requested_action =
        static_cast<std::uint32_t>(opus::bootstrap::Action::Stop);
    if (!events->emit(
            options,
            iteration,
            "BootstrapStopPending",
            "Success",
            &control,
            false
        )) {
        const bool stopped = stop_after_failed_observation(stop, session_nonce);
        std::string cleanup_detail;
        const bool unloaded = stopped && close_module(&module, &cleanup_detail);
        failure->cleanup_complete = unloaded;
        failure->code = unloaded
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = unloaded
            ? "could not write BootstrapStopPending event"
            : (stopped ? cleanup_detail : "logical stop acknowledgement failed");
        return false;
    }

    const auto stop_result =
        static_cast<opus::bootstrap::Status>(stop(&control));
    if (stop_result != opus::bootstrap::Status::Ok || !control_matches_stopped(control)) {
        failure->cleanup_complete = false;
        failure->code = failure_code_for_status(stop_result, true);
        failure->detail = opus::bootstrap::status_name(stop_result);
        (void)events->emit(
            options,
            iteration,
            "BootstrapCleanupRequired",
            failure->code,
            &control,
            false
        );
        return false;
    }
    if (!events->emit(
            options,
            iteration,
            "BootstrapStopped",
            "Success",
            &control,
            false
        )) {
        std::string cleanup_detail;
        failure->cleanup_complete = close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? "could not write BootstrapStopped event"
            : cleanup_detail;
        return false;
    }

    if (!events->emit(
            options,
            iteration,
            "BootstrapUnloadPending",
            "Success",
            &control,
            false
        )) {
        std::string cleanup_detail;
        failure->cleanup_complete = close_module(&module, &cleanup_detail);
        failure->code = failure->cleanup_complete
            ? "BootstrapEvidenceMissing"
            : "BootstrapCleanupFailed";
        failure->detail = failure->cleanup_complete
            ? "could not write BootstrapUnloadPending event"
            : cleanup_detail;
        return false;
    }

    std::string cleanup_detail;
    if (!close_module(&module, &cleanup_detail)) {
        failure->cleanup_complete = false;
        failure->code = "BootstrapUnloadFailed";
        failure->detail = cleanup_detail;
        (void)events->emit(
            options,
            iteration,
            "BootstrapCleanupFailed",
            failure->code,
            &control,
            false
        );
        return false;
    }
    failure->cleanup_complete = true;
    if (!events->emit(
            options,
            iteration,
            "BootstrapCleanedUp",
            "Success",
            &control,
            true
        )) {
        failure->code = "BootstrapEvidenceMissing";
        failure->detail = "could not write BootstrapCleanedUp event";
        return false;
    }
    *completed_control = control;
    return true;
}

int emit_failure(
    EventWriter* events,
    const Options& options,
    std::uint32_t iteration,
    const CycleFailure& failure
) {
    if (events != nullptr) {
        opus::bootstrap::ControlBlock control;
        (void)events->emit(
            options,
            iteration,
            "BootstrapCleanupRequired",
            failure.code,
            &control,
            failure.cleanup_complete
        );
    }
    std::cerr << "[OPUS/BOOTSTRAP] code=" << failure.code
              << " state=BootstrapCleanupRequired"
              << " architecture=" << kHostArchitecture
              << " iteration=" << iteration << "/" << options.iterations
              << " cleanup=" << (failure.cleanup_complete ? "true" : "false")
              << " detail=" << line_value(failure.detail) << '\n';
    return 2;
}

void print_usage() {
    std::cerr
        << "Usage: opus-bootstrap-host --bootstrap <absolute-dylib-path> "
        << "--bootstrap-sha256 <lowercase-sha256> "
        << "--iterations <1-25> --session-nonce <nonzero-u64> "
        << "--run-id <identifier> --events-file <absolute-jsonl-path>\n";
}

}  // namespace

int main(int argc, char* argv[]) {
    Options options;
    if (!parse_options(argc, argv, &options)) {
        print_usage();
        return 2;
    }
    if (std::string_view(kHostArchitecture) != "arm64") {
        CycleFailure failure {
            "BootstrapArchitectureMismatch",
            "Gate 6 owned-harness execution requires an arm64 host",
            true,
        };
        return emit_failure(nullptr, options, 0U, failure);
    }
    if (!canonical_existing_path(options.bootstrap_path, &options.bootstrap_path)) {
        CycleFailure failure {
            "BootstrapArtifactInvalid",
            "bootstrap path must be an existing absolute regular file",
            true,
        };
        return emit_failure(nullptr, options, 0U, failure);
    }
    if (!is_writable_events_path(options.events_path)) {
        CycleFailure failure {
            "BootstrapEvidenceMissing",
            "events path must have an existing absolute parent directory",
            true,
        };
        return emit_failure(nullptr, options, 0U, failure);
    }

    EventWriter events(options.events_path);
    if (!events.is_open()) {
        CycleFailure failure {
            "BootstrapEvidenceMissing",
            "could not open lifecycle event witness",
            true,
        };
        return emit_failure(nullptr, options, 0U, failure);
    }

    std::string digest_detail;
    if (!sha256_for_file(
            options.bootstrap_path,
            &options.observed_bootstrap_sha256,
            &digest_detail
        )) {
        CycleFailure failure {
            "BootstrapArtifactInvalid",
            digest_detail,
            true,
        };
        return emit_failure(&events, options, 0U, failure);
    }
    if (
        options.observed_bootstrap_sha256 !=
        options.expected_bootstrap_sha256
    ) {
        CycleFailure failure {
            "BootstrapArtifactIdentityMismatch",
            "expected_bootstrap_sha256=" +
                options.expected_bootstrap_sha256 +
                " observed_bootstrap_sha256=" +
                options.observed_bootstrap_sha256,
            true,
        };
        return emit_failure(&events, options, 0U, failure);
    }

    opus::bootstrap::ControlBlock startup_control =
        control_for(options.session_nonce, opus::bootstrap::Action::Start);
    if (!events.emit(
            options,
            0U,
            "TargetResolved",
            "Success",
            &startup_control,
            false
        )) {
        CycleFailure failure {
            "BootstrapEvidenceMissing",
            "could not write TargetResolved event",
            true,
        };
        return emit_failure(&events, options, 0U, failure);
    }
    if (!events.emit(
            options,
            0U,
            "TransportReady",
            "Success",
            &startup_control,
            false
        )) {
        CycleFailure failure {
            "BootstrapEvidenceMissing",
            "could not write TransportReady event",
            true,
        };
        return emit_failure(&events, options, 0U, failure);
    }

    opus::bootstrap::ControlBlock last_control;
    for (std::uint32_t iteration = 1U; iteration <= options.iterations; ++iteration) {
        CycleFailure failure;
        if (!run_cycle(options, &events, iteration, &failure, &last_control)) {
            return emit_failure(&events, options, iteration, failure);
        }
    }

    const bool ready = options.iterations >= kMaximumIterations;
    const char* code = ready ? "BootstrapLoadReady" : "BootstrapLoadObserved";
    const char* state = ready ? "BootstrapLoadReady" : "BootstrapLoadObserved";
    if (!events.emit(
            options,
            options.iterations,
            state,
            "Success",
            &last_control,
            true
        )) {
        CycleFailure failure {
            "BootstrapEvidenceMissing",
            "could not write final lifecycle event",
            true,
        };
        return emit_failure(&events, options, options.iterations, failure);
    }

    std::cout << "[OPUS/BOOTSTRAP] code=" << code << " state=" << state
              << " architecture=" << kHostArchitecture
              << " bootstrap_architecture=arm64"
              << " artifact_identity=verified"
              << " expected_bootstrap_sha256="
              << options.expected_bootstrap_sha256
              << " observed_bootstrap_sha256="
              << options.observed_bootstrap_sha256
              << " handshake_verified=true"
              << " stop_acknowledged=true"
              << " cleanup=true"
              << " dlclose_return=0"
              << " host_alive=true"
              << " iterations_completed=" << options.iterations
              << " iterations_requested=" << options.iterations
              << " iteration=" << options.iterations << "/"
              << options.iterations
              << " marker=not-applicable"
              << " session_nonce=" << hexadecimal(last_control.session_nonce)
              << " expected_handshake="
              << hexadecimal(last_control.expected_handshake)
              << " observed_handshake="
              << hexadecimal(last_control.observed_handshake)
              << " stop_acknowledgement="
              << hexadecimal(last_control.stop_acknowledgement)
              << " cleanup_acknowledgement="
              << hexadecimal(last_control.cleanup_acknowledgement) << '\n';
    return 0;
}
