#include "cooperative_vm_probe_protocol.hpp"

#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <thread>
#include <unistd.h>

namespace {

constexpr int kDefaultRuntimeSeconds = 30;

volatile std::uint64_t g_public_vm_read_marker =
    opus::cooperative_vm_probe::kVmReadMarker;

struct TargetOptions {
    int runtime_seconds = kDefaultRuntimeSeconds;
    bool publish_vm_read_marker = false;
    bool allow_vm_rw_probe = false;
};

bool parse_runtime_seconds(const char* value, int* runtime_seconds) {
    if (value == nullptr || runtime_seconds == nullptr) {
        return false;
    }
    char* end = nullptr;
    const long parsed = std::strtol(value, &end, 10);
    if (
        end == value || *end != '\0' || parsed <= 0 ||
        parsed > std::numeric_limits<int>::max()
    ) {
        return false;
    }
    *runtime_seconds = static_cast<int>(parsed);
    return true;
}

bool parse_options(int argc, char* argv[], TargetOptions* options) {
    if (options == nullptr) {
        return false;
    }
    for (int index = 1; index < argc; ++index) {
        const std::string argument(argv[index]);
        if (argument == "--seconds") {
            if (
                index + 1 >= argc ||
                !parse_runtime_seconds(argv[index + 1], &options->runtime_seconds)
            ) {
                return false;
            }
            ++index;
            continue;
        }
        if (argument == "--publish-vm-read-marker") {
            options->publish_vm_read_marker = true;
            continue;
        }
        if (argument == "--allow-vm-rw-probe") {
            options->publish_vm_read_marker = true;
            options->allow_vm_rw_probe = true;
            continue;
        }
        return false;
    }
    return true;
}

}  // namespace

int main(int argc, char* argv[]) {
    TargetOptions options;
    if (!parse_options(argc, argv, &options)) {
        std::cerr
            << "Usage: opus-task-port-probe-target "
            << "[--seconds <positive-integer>] "
            << "[--publish-vm-read-marker] [--allow-vm-rw-probe]\n";
        return 2;
    }

    const pid_t pid = getpid();
    std::string descriptor_path;
    if (options.publish_vm_read_marker) {
        opus::cooperative_vm_probe::Descriptor descriptor;
        std::string detail;
        if (
            !opus::cooperative_vm_probe::initialize_descriptor_for_current_process(
                argv[0],
                options.allow_vm_rw_probe,
                static_cast<mach_vm_address_t>(
                    reinterpret_cast<std::uintptr_t>(&g_public_vm_read_marker)
                ),
                &descriptor,
                &detail
            ) ||
            !opus::cooperative_vm_probe::publish_descriptor(
                descriptor,
                &descriptor_path,
                &detail
            )
        ) {
            std::cerr << "[OPUS/COOPERATIVE-VM-TARGET] "
                      << "code=VmProbeTargetDescriptorFailed"
                      << " message=" << detail << '\n';
            return 2;
        }
    }

    std::cout << "OPUS_TASK_PORT_PROBE_TARGET pid=" << pid << '\n';
    if (options.publish_vm_read_marker) {
        std::cout << "[OPUS/COOPERATIVE-VM-TARGET] code=VmProbeTargetReady"
                  << " pid=" << pid
                  << " capabilities=vm_read";
        if (options.allow_vm_rw_probe) {
            std::cout << ",vm_rw";
        }
        std::cout << " state=waiting"
                  << " descriptor=" << descriptor_path
                  << '\n';
    }
    std::cout.flush();

    std::this_thread::sleep_for(std::chrono::seconds(options.runtime_seconds));
    if (!descriptor_path.empty()) {
        (void)unlink(descriptor_path.c_str());
    }
    return 0;
}
