#include <chrono>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <thread>
#include <unistd.h>

namespace {

constexpr int kDefaultRuntimeSeconds = 30;

int parse_runtime_seconds(int argc, char* argv[]) {
    if (argc == 1) {
        return kDefaultRuntimeSeconds;
    }
    if (argc != 3 || std::string(argv[1]) != "--seconds") {
        return -1;
    }

    char* end = nullptr;
    const long parsed = std::strtol(argv[2], &end, 10);
    if (
        end == argv[2] || *end != '\0' || parsed <= 0 ||
        parsed > std::numeric_limits<int>::max()
    ) {
        return -1;
    }
    return static_cast<int>(parsed);
}

}  // namespace

int main(int argc, char* argv[]) {
    const int runtime_seconds = parse_runtime_seconds(argc, argv);
    if (runtime_seconds <= 0) {
        std::cerr << "Usage: opus-task-port-probe-target [--seconds <positive-integer>]\n";
        return 2;
    }

    std::cout << "OPUS_TASK_PORT_PROBE_TARGET pid=" << getpid() << '\n';
    std::cout.flush();
    std::this_thread::sleep_for(std::chrono::seconds(runtime_seconds));
    return 0;
}
