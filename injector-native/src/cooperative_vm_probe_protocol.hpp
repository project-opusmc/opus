#pragma once

#include <cstdint>
#include <mach/mach_vm.h>
#include <string>
#include <sys/types.h>

namespace opus::cooperative_vm_probe {

constexpr std::uint32_t kSchemaVersion = 2;
constexpr std::uint64_t kVmReadMarker = 0x4f5055534d335652ULL;

struct Descriptor {
    pid_t pid = -1;
    std::uint64_t process_start_seconds = 0;
    std::uint64_t process_start_microseconds = 0;
    std::string target_executable;
    std::string session_nonce;
    mach_vm_address_t marker_address = 0;
    std::uint64_t marker_value = 0;
    bool allows_vm_read = false;
    bool allows_vm_rw = false;
};

std::string descriptor_path(pid_t pid);

bool initialize_descriptor_for_current_process(
    const char* argv0,
    bool allow_vm_rw,
    mach_vm_address_t marker_address,
    Descriptor* descriptor,
    std::string* detail
);

bool publish_descriptor(
    const Descriptor& descriptor,
    std::string* published_path,
    std::string* detail
);

bool read_descriptor(
    pid_t expected_pid,
    Descriptor* descriptor,
    std::string* detail
);

bool selected_target_matches_descriptor(
    pid_t selected_pid,
    const Descriptor& descriptor,
    std::string* detail
);

}  // namespace opus::cooperative_vm_probe
