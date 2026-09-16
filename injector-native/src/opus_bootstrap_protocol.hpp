#pragma once

#include <cstdint>
#include <type_traits>

namespace opus::bootstrap {

constexpr std::uint32_t kAbiMagic = 0x4f505336U;
constexpr std::uint32_t kAbiVersion = 1U;
constexpr std::uint64_t kHandshakeSalt = 0x9f6d3a51c4b8270eULL;
constexpr std::uint64_t kStopAcknowledgementSalt = 0x53a17e204d9cb6f1ULL;
constexpr std::uint64_t kCleanupAcknowledgementSalt = 0xc7e8913a5f206db4ULL;

enum class Action : std::uint32_t {
    None = 0U,
    Start = 1U,
    Stop = 2U,
};

enum class State : std::uint32_t {
    NotStarted = 0U,
    Started = 1U,
    Stopped = 2U,
    CleanedUp = 3U,
};

enum class Status : std::uint32_t {
    Ok = 0U,
    InvalidControlBlock = 1U,
    UnsupportedAbi = 2U,
    InvalidAction = 3U,
    InvalidHandshake = 4U,
    AlreadyActive = 5U,
    NotActive = 6U,
    SessionMismatch = 7U,
};

struct ControlBlock {
    std::uint32_t abi_magic = kAbiMagic;
    std::uint32_t abi_version = kAbiVersion;
    std::uint64_t session_nonce = 0U;
    std::uint32_t requested_action = static_cast<std::uint32_t>(Action::None);
    std::uint32_t observed_state = static_cast<std::uint32_t>(State::NotStarted);
    std::uint32_t status = static_cast<std::uint32_t>(Status::Ok);
    std::uint32_t reserved = 0U;
    std::uint64_t expected_handshake = 0U;
    std::uint64_t observed_handshake = 0U;
    std::uint64_t stop_acknowledgement = 0U;
    std::uint64_t cleanup_acknowledgement = 0U;
};

static_assert(std::is_standard_layout_v<ControlBlock>);
static_assert(sizeof(ControlBlock) == 64U);

constexpr std::uint64_t rotate_left(std::uint64_t value, unsigned int amount) {
    return (value << amount) | (value >> (64U - amount));
}

constexpr std::uint64_t handshake_for(
    std::uint64_t session_nonce,
    std::uint32_t abi_version
) {
    return rotate_left(session_nonce ^ kHandshakeSalt, 17U) ^
        (static_cast<std::uint64_t>(abi_version) << 32U) ^
        static_cast<std::uint64_t>(kAbiMagic);
}

constexpr std::uint64_t stop_acknowledgement_for(
    std::uint64_t session_nonce,
    std::uint32_t abi_version
) {
    return rotate_left(handshake_for(session_nonce, abi_version) ^
        kStopAcknowledgementSalt, 11U);
}

constexpr std::uint64_t cleanup_acknowledgement_for(
    std::uint64_t session_nonce,
    std::uint32_t abi_version
) {
    return rotate_left(stop_acknowledgement_for(session_nonce, abi_version) ^
        kCleanupAcknowledgementSalt, 7U);
}

constexpr const char* status_name(Status status) {
    switch (status) {
        case Status::Ok:
            return "Ok";
        case Status::InvalidControlBlock:
            return "InvalidControlBlock";
        case Status::UnsupportedAbi:
            return "UnsupportedAbi";
        case Status::InvalidAction:
            return "InvalidAction";
        case Status::InvalidHandshake:
            return "InvalidHandshake";
        case Status::AlreadyActive:
            return "AlreadyActive";
        case Status::NotActive:
            return "NotActive";
        case Status::SessionMismatch:
            return "SessionMismatch";
    }
    return "Unknown";
}

using Entrypoint = std::uint32_t (*)(ControlBlock*);

}  // namespace opus::bootstrap
