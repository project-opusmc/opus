#include <fcntl.h>
#include <unistd.h>

#include <array>
#include <cstdio>

namespace {

void write_probe_marker() {
    std::array<char, 128> marker_path {};
    const int path_length = std::snprintf(
        marker_path.data(),
        marker_path.size(),
        "/tmp/opus-remote-loader-probe-%d.ready",
        getpid()
    );
    if (
        path_length <= 0 ||
        static_cast<std::size_t>(path_length) >= marker_path.size()
    ) {
        return;
    }

    const int descriptor = open(
        marker_path.data(),
        O_WRONLY | O_CREAT | O_EXCL,
        S_IRUSR | S_IWUSR
    );
    if (descriptor < 0) {
        return;
    }

    constexpr const char kMarker[] = "loaded\n";
    (void)write(descriptor, kMarker, sizeof(kMarker) - 1U);
    (void)close(descriptor);
}

}  // namespace

__attribute__((constructor))
static void opus_remote_loader_probe_constructor() {
    write_probe_marker();
}
