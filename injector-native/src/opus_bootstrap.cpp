#include "opus_bootstrap_protocol.hpp"

#include <atomic>

namespace {

std::atomic<std::uint64_t> g_active_session_nonce {0U};

std::uint32_t fail(
    opus::bootstrap::ControlBlock* control,
    opus::bootstrap::Status status
) {
    if (control != nullptr) {
        control->status = static_cast<std::uint32_t>(status);
    }
    return static_cast<std::uint32_t>(status);
}

bool has_supported_header(const opus::bootstrap::ControlBlock& control) {
    return control.abi_magic == opus::bootstrap::kAbiMagic &&
        control.abi_version == opus::bootstrap::kAbiVersion;
}

bool has_expected_handshake(const opus::bootstrap::ControlBlock& control) {
    return control.expected_handshake == opus::bootstrap::handshake_for(
        control.session_nonce,
        control.abi_version
    );
}

}  // namespace

extern "C" std::uint32_t opus_bootstrap_start(
    opus::bootstrap::ControlBlock* control
) {
    if (control == nullptr) {
        return static_cast<std::uint32_t>(
            opus::bootstrap::Status::InvalidControlBlock
        );
    }
    if (!has_supported_header(*control)) {
        return fail(control, opus::bootstrap::Status::UnsupportedAbi);
    }
    if (
        control->session_nonce == 0U ||
        control->requested_action !=
            static_cast<std::uint32_t>(opus::bootstrap::Action::Start)
    ) {
        return fail(control, opus::bootstrap::Status::InvalidAction);
    }
    if (!has_expected_handshake(*control)) {
        return fail(control, opus::bootstrap::Status::InvalidHandshake);
    }

    std::uint64_t expected_inactive_nonce = 0U;
    if (!g_active_session_nonce.compare_exchange_strong(
            expected_inactive_nonce,
            control->session_nonce
        )) {
        return fail(control, opus::bootstrap::Status::AlreadyActive);
    }

    control->observed_handshake = control->expected_handshake;
    control->observed_state =
        static_cast<std::uint32_t>(opus::bootstrap::State::Started);
    control->stop_acknowledgement = 0U;
    control->cleanup_acknowledgement = 0U;
    control->status = static_cast<std::uint32_t>(opus::bootstrap::Status::Ok);
    return static_cast<std::uint32_t>(opus::bootstrap::Status::Ok);
}

extern "C" std::uint32_t opus_bootstrap_stop(
    opus::bootstrap::ControlBlock* control
) {
    if (control == nullptr) {
        return static_cast<std::uint32_t>(
            opus::bootstrap::Status::InvalidControlBlock
        );
    }
    if (!has_supported_header(*control)) {
        return fail(control, opus::bootstrap::Status::UnsupportedAbi);
    }
    if (
        control->session_nonce == 0U ||
        control->requested_action !=
            static_cast<std::uint32_t>(opus::bootstrap::Action::Stop)
    ) {
        return fail(control, opus::bootstrap::Status::InvalidAction);
    }
    if (!has_expected_handshake(*control)) {
        return fail(control, opus::bootstrap::Status::InvalidHandshake);
    }

    std::uint64_t expected_active_nonce = control->session_nonce;
    if (!g_active_session_nonce.compare_exchange_strong(
            expected_active_nonce,
            0U
        )) {
        return fail(
            control,
            expected_active_nonce == 0U
                ? opus::bootstrap::Status::NotActive
                : opus::bootstrap::Status::SessionMismatch
        );
    }

    control->observed_handshake = control->expected_handshake;
    control->stop_acknowledgement = opus::bootstrap::stop_acknowledgement_for(
        control->session_nonce,
        control->abi_version
    );
    control->cleanup_acknowledgement =
        opus::bootstrap::cleanup_acknowledgement_for(
            control->session_nonce,
            control->abi_version
        );
    control->observed_state =
        static_cast<std::uint32_t>(opus::bootstrap::State::CleanedUp);
    control->status = static_cast<std::uint32_t>(opus::bootstrap::Status::Ok);
    return static_cast<std::uint32_t>(opus::bootstrap::Status::Ok);
}
