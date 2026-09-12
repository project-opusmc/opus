#include "cooperative_vm_probe_protocol.hpp"

#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <libproc.h>
#include <limits>
#include <limits.h>
#include <sys/stat.h>
#include <unistd.h>
#include <utility>

namespace opus::cooperative_vm_probe {
namespace {

constexpr off_t kMaximumDescriptorBytes = 2048;
constexpr std::size_t kNonceBytes = 16;
constexpr std::size_t kNonceHexLength = kNonceBytes * 2U;

bool canonical_path(const std::string& path, std::string* resolved) {
    if (resolved == nullptr) {
        return false;
    }
    char buffer[PATH_MAX] {};
    if (realpath(path.c_str(), buffer) == nullptr) {
        return false;
    }
    *resolved = buffer;
    return true;
}

bool process_identity(
    pid_t pid,
    std::string* executable,
    std::uint64_t* start_seconds,
    std::uint64_t* start_microseconds,
    std::string* detail
) {
    if (
        executable == nullptr || start_seconds == nullptr ||
        start_microseconds == nullptr || detail == nullptr
    ) {
        return false;
    }

    char process_path[PROC_PIDPATHINFO_MAXSIZE] {};
    if (proc_pidpath(pid, process_path, sizeof(process_path)) <= 0) {
        *detail = "cannot resolve selected PID executable";
        return false;
    }
    if (!canonical_path(process_path, executable)) {
        *detail = "cannot canonicalize selected PID executable";
        return false;
    }

    proc_bsdinfo process_info {};
    const int bytes = proc_pidinfo(
        pid,
        PROC_PIDTBSDINFO,
        0,
        &process_info,
        sizeof(process_info)
    );
    if (bytes != static_cast<int>(sizeof(process_info))) {
        *detail = "cannot resolve selected PID process-instance identity";
        return false;
    }
    *start_seconds = process_info.pbi_start_tvsec;
    *start_microseconds = process_info.pbi_start_tvusec;
    return true;
}

bool write_all(int file, const char* contents, std::size_t size) {
    std::size_t remaining = size;
    const char* cursor = contents;
    while (remaining > 0U) {
        const ssize_t written = write(file, cursor, remaining);
        if (written < 0) {
            if (errno == EINTR) {
                continue;
            }
            return false;
        }
        if (written == 0) {
            return false;
        }
        cursor += static_cast<std::size_t>(written);
        remaining -= static_cast<std::size_t>(written);
    }
    return true;
}

bool parse_uint64(const std::string& value, std::uint64_t* parsed) {
    if (parsed == nullptr || value.empty()) {
        return false;
    }
    errno = 0;
    char* end = nullptr;
    const unsigned long long result = std::strtoull(value.c_str(), &end, 0);
    if (errno != 0 || end == value.c_str() || *end != '\0') {
        return false;
    }
    *parsed = static_cast<std::uint64_t>(result);
    return true;
}

bool valid_nonce(const std::string& value) {
    if (value.size() != kNonceHexLength) {
        return false;
    }
    for (const unsigned char character : value) {
        const bool is_digit = character >= '0' && character <= '9';
        const bool is_lower_hex = character >= 'a' && character <= 'f';
        if (!is_digit && !is_lower_hex) {
            return false;
        }
    }
    return true;
}

std::string create_nonce() {
    std::array<unsigned char, kNonceBytes> bytes {};
    arc4random_buf(bytes.data(), bytes.size());

    constexpr char kHex[] = "0123456789abcdef";
    std::string nonce;
    nonce.reserve(kNonceHexLength);
    for (const unsigned char value : bytes) {
        nonce.push_back(kHex[(value >> 4U) & 0x0fU]);
        nonce.push_back(kHex[value & 0x0fU]);
    }
    return nonce;
}

bool parse_capabilities(
    const std::string& value,
    bool* allows_vm_read,
    bool* allows_vm_rw
) {
    if (allows_vm_read == nullptr || allows_vm_rw == nullptr) {
        return false;
    }
    if (value == "vm_read") {
        *allows_vm_read = true;
        *allows_vm_rw = false;
        return true;
    }
    if (value == "vm_read,vm_rw") {
        *allows_vm_read = true;
        *allows_vm_rw = true;
        return true;
    }
    return false;
}

bool valid_path_field(const std::string& value) {
    return !value.empty() && value.find('\r') == std::string::npos &&
        value.find('\n') == std::string::npos;
}

}  // namespace

std::string descriptor_path(pid_t pid) {
    return "/tmp/opus-cooperative-vm-probe-" + std::to_string(pid) +
        ".descriptor";
}

bool initialize_descriptor_for_current_process(
    const char* argv0,
    bool allow_vm_rw,
    mach_vm_address_t marker_address,
    Descriptor* descriptor,
    std::string* detail
) {
    if (argv0 == nullptr || descriptor == nullptr || detail == nullptr) {
        return false;
    }
    const pid_t pid = getpid();
    std::string executable;
    std::uint64_t start_seconds = 0;
    std::uint64_t start_microseconds = 0;
    if (
        !process_identity(
            pid,
            &executable,
            &start_seconds,
            &start_microseconds,
            detail
        )
    ) {
        return false;
    }

    std::string argv_path;
    if (!canonical_path(argv0, &argv_path) || argv_path != executable) {
        *detail = "target executable identity did not match argv[0]";
        return false;
    }

    descriptor->pid = pid;
    descriptor->process_start_seconds = start_seconds;
    descriptor->process_start_microseconds = start_microseconds;
    descriptor->target_executable = executable;
    descriptor->session_nonce = create_nonce();
    descriptor->marker_address = marker_address;
    descriptor->marker_value = kVmReadMarker;
    descriptor->allows_vm_read = true;
    descriptor->allows_vm_rw = allow_vm_rw;
    return true;
}

bool publish_descriptor(
    const Descriptor& descriptor,
    std::string* published_path,
    std::string* detail
) {
    if (
        published_path == nullptr || detail == nullptr || descriptor.pid <= 0 ||
        descriptor.marker_address == 0U ||
        descriptor.marker_value != kVmReadMarker ||
        !descriptor.allows_vm_read ||
        !valid_path_field(descriptor.target_executable) ||
        !valid_nonce(descriptor.session_nonce)
    ) {
        if (detail != nullptr) {
            *detail = "descriptor fields are invalid";
        }
        return false;
    }

    const std::string path = descriptor_path(descriptor.pid);
    const int file = open(
        path.c_str(),
        O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW,
        S_IRUSR | S_IWUSR
    );
    if (file < 0) {
        *detail = "cannot create owner-only descriptor";
        return false;
    }

    const char* capabilities = descriptor.allows_vm_rw
        ? "vm_read,vm_rw"
        : "vm_read";
    char contents[1024] {};
    const int length = std::snprintf(
        contents,
        sizeof(contents),
        "schema=%u\n"
        "pid=%d\n"
        "process_start_seconds=%llu\n"
        "process_start_microseconds=%llu\n"
        "target_executable=%s\n"
        "session_nonce=%s\n"
        "capabilities=%s\n"
        "marker_address=0x%llx\n"
        "marker_value=0x%llx\n",
        kSchemaVersion,
        static_cast<int>(descriptor.pid),
        static_cast<unsigned long long>(descriptor.process_start_seconds),
        static_cast<unsigned long long>(descriptor.process_start_microseconds),
        descriptor.target_executable.c_str(),
        descriptor.session_nonce.c_str(),
        capabilities,
        static_cast<unsigned long long>(descriptor.marker_address),
        static_cast<unsigned long long>(descriptor.marker_value)
    );
    const bool written = length > 0 &&
        static_cast<std::size_t>(length) < sizeof(contents) &&
        write_all(file, contents, static_cast<std::size_t>(length));
    const int close_result = close(file);
    if (!written || close_result != 0) {
        (void)unlink(path.c_str());
        *detail = "cannot publish complete descriptor";
        return false;
    }

    *published_path = path;
    return true;
}

bool read_descriptor(
    pid_t expected_pid,
    Descriptor* descriptor,
    std::string* detail
) {
    if (descriptor == nullptr || detail == nullptr || expected_pid <= 0) {
        return false;
    }

    const std::string path = descriptor_path(expected_pid);
    struct stat link_metadata {};
    if (lstat(path.c_str(), &link_metadata) != 0) {
        *detail = "cooperative descriptor is absent";
        return false;
    }
    if (
        !S_ISREG(link_metadata.st_mode) ||
        link_metadata.st_size <= 0 ||
        link_metadata.st_size > kMaximumDescriptorBytes ||
        (link_metadata.st_mode & (S_IRWXG | S_IRWXO)) != 0
    ) {
        *detail = "cooperative descriptor does not meet file constraints";
        return false;
    }

    const int file = open(path.c_str(), O_RDONLY | O_NOFOLLOW);
    if (file < 0) {
        *detail = "cooperative descriptor cannot be opened safely";
        return false;
    }

    struct stat opened_metadata {};
    const bool same_file =
        fstat(file, &opened_metadata) == 0 &&
        opened_metadata.st_dev == link_metadata.st_dev &&
        opened_metadata.st_ino == link_metadata.st_ino;
    if (!same_file) {
        close(file);
        *detail = "cooperative descriptor changed while opening";
        return false;
    }

    char contents[static_cast<std::size_t>(kMaximumDescriptorBytes) + 1U] {};
    std::size_t total = 0;
    while (total < static_cast<std::size_t>(opened_metadata.st_size)) {
        const ssize_t read_count = read(
            file,
            contents + total,
            static_cast<std::size_t>(opened_metadata.st_size) - total
        );
        if (read_count < 0) {
            if (errno == EINTR) {
                continue;
            }
            close(file);
            *detail = "cooperative descriptor read failed";
            return false;
        }
        if (read_count == 0) {
            close(file);
            *detail = "cooperative descriptor ended unexpectedly";
            return false;
        }
        total += static_cast<std::size_t>(read_count);
    }
    close(file);

    bool schema_seen = false;
    bool pid_seen = false;
    bool start_seconds_seen = false;
    bool start_microseconds_seen = false;
    bool executable_seen = false;
    bool nonce_seen = false;
    bool capabilities_seen = false;
    bool marker_address_seen = false;
    bool marker_value_seen = false;
    Descriptor parsed;
    std::uint64_t descriptor_pid = 0;
    std::string text(contents, total);
    std::size_t start = 0;
    while (start < text.size()) {
        const std::size_t end = text.find('\n', start);
        const std::string line = text.substr(start, end - start);
        const std::size_t separator = line.find('=');
        if (separator == std::string::npos) {
            *detail = "cooperative descriptor contains an invalid line";
            return false;
        }
        const std::string key = line.substr(0, separator);
        const std::string value = line.substr(separator + 1);
        bool parsed_value = false;
        if (key == "schema" && !schema_seen) {
            schema_seen = true;
            std::uint64_t schema = 0;
            parsed_value = parse_uint64(value, &schema) &&
                schema == kSchemaVersion;
        } else if (key == "pid" && !pid_seen) {
            pid_seen = true;
            parsed_value = parse_uint64(value, &descriptor_pid);
        } else if (
            key == "process_start_seconds" && !start_seconds_seen
        ) {
            start_seconds_seen = true;
            parsed_value = parse_uint64(value, &parsed.process_start_seconds);
        } else if (
            key == "process_start_microseconds" && !start_microseconds_seen
        ) {
            start_microseconds_seen = true;
            parsed_value = parse_uint64(
                value,
                &parsed.process_start_microseconds
            );
        } else if (key == "target_executable" && !executable_seen) {
            executable_seen = true;
            parsed.target_executable = value;
            parsed_value = valid_path_field(value);
        } else if (key == "session_nonce" && !nonce_seen) {
            nonce_seen = true;
            parsed.session_nonce = value;
            parsed_value = valid_nonce(value);
        } else if (key == "capabilities" && !capabilities_seen) {
            capabilities_seen = true;
            parsed_value = parse_capabilities(
                value,
                &parsed.allows_vm_read,
                &parsed.allows_vm_rw
            );
        } else if (key == "marker_address" && !marker_address_seen) {
            marker_address_seen = true;
            std::uint64_t address = 0;
            parsed_value = parse_uint64(value, &address);
            parsed.marker_address = static_cast<mach_vm_address_t>(address);
        } else if (key == "marker_value" && !marker_value_seen) {
            marker_value_seen = true;
            parsed_value = parse_uint64(value, &parsed.marker_value);
        }
        if (!parsed_value) {
            *detail = "cooperative descriptor contains an unexpected field";
            return false;
        }
        if (end == std::string::npos) {
            break;
        }
        start = end + 1U;
    }

    if (
        !schema_seen || !pid_seen || !start_seconds_seen ||
        !start_microseconds_seen || !executable_seen || !nonce_seen ||
        !capabilities_seen || !marker_address_seen || !marker_value_seen ||
        descriptor_pid != static_cast<std::uint64_t>(expected_pid) ||
        parsed.marker_address == 0U || parsed.marker_value != kVmReadMarker ||
        !parsed.allows_vm_read
    ) {
        *detail = "cooperative descriptor does not match selected target";
        return false;
    }

    parsed.pid = expected_pid;
    *descriptor = std::move(parsed);
    return true;
}

bool selected_target_matches_descriptor(
    pid_t selected_pid,
    const Descriptor& descriptor,
    std::string* detail
) {
    if (detail == nullptr || descriptor.pid != selected_pid) {
        return false;
    }
    std::string executable;
    std::uint64_t start_seconds = 0;
    std::uint64_t start_microseconds = 0;
    if (
        !process_identity(
            selected_pid,
            &executable,
            &start_seconds,
            &start_microseconds,
            detail
        )
    ) {
        return false;
    }
    if (
        executable != descriptor.target_executable ||
        start_seconds != descriptor.process_start_seconds ||
        start_microseconds != descriptor.process_start_microseconds
    ) {
        *detail = "selected PID does not match cooperative target identity";
        return false;
    }
    return true;
}

}  // namespace opus::cooperative_vm_probe
