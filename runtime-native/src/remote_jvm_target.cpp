#include <jni.h>

#include <unistd.h>

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr int kDefaultRuntimeSeconds = 30;

bool parse_arguments(
    int argc,
    char* argv[],
    int* runtime_seconds,
    std::vector<std::string>* vm_options
) {
    if (runtime_seconds == nullptr || vm_options == nullptr) {
        return false;
    }

    *runtime_seconds = kDefaultRuntimeSeconds;
    vm_options->push_back("-Djava.class.path=.");
    for (int index = 1; index < argc; ++index) {
        const std::string argument(argv[index]);
        if (argument == "--seconds") {
            if (index + 1 >= argc) {
                return false;
            }
            char* end = nullptr;
            const long parsed = std::strtol(argv[index + 1], &end, 10);
            if (
                end == argv[index + 1] || *end != '\0' || parsed <= 0 ||
                parsed > std::numeric_limits<int>::max()
            ) {
                return false;
            }
            *runtime_seconds = static_cast<int>(parsed);
            ++index;
            continue;
        }
        if (argument.rfind("-D", 0) == 0U && argument.size() > 2U) {
            vm_options->push_back(argument);
            continue;
        }
        return false;
    }
    return true;
}

}  // namespace

int main(int argc, char* argv[]) {
    int runtime_seconds = 0;
    std::vector<std::string> option_strings;
    if (!parse_arguments(argc, argv, &runtime_seconds, &option_strings)) {
        std::cerr
            << "Usage: java [--seconds <positive-integer>] "
            << "[-Dname=value ...]\n";
        return 2;
    }

    std::vector<JavaVMOption> options;
    options.reserve(option_strings.size());
    for (std::string& option : option_strings) {
        options.push_back(JavaVMOption {
            const_cast<char*>(option.c_str()),
            nullptr,
        });
    }

    JavaVMInitArgs initialization {};
    initialization.version = JNI_VERSION_1_8;
    initialization.nOptions = static_cast<jint>(options.size());
    initialization.options = options.data();
    initialization.ignoreUnrecognized = JNI_FALSE;

    JavaVM* vm = nullptr;
    JNIEnv* environment = nullptr;
    const jint create_result = JNI_CreateJavaVM(
        &vm,
        reinterpret_cast<void**>(&environment),
        &initialization
    );
    if (create_result != JNI_OK || vm == nullptr || environment == nullptr) {
        std::cerr << "OPUS_REMOTE_JVM_TARGET error=JNI_CreateJavaVM\n";
        return 1;
    }

    std::cout
        << "OPUS_REMOTE_JVM_TARGET pid=" << getpid()
        << ";state=running\n";
    std::cout.flush();
    std::this_thread::sleep_for(std::chrono::seconds(runtime_seconds));

    const jint destroy_result = vm->DestroyJavaVM();
    if (destroy_result != JNI_OK) {
        std::cerr << "OPUS_REMOTE_JVM_TARGET error=DestroyJavaVM\n";
        return 1;
    }
    return 0;
}
