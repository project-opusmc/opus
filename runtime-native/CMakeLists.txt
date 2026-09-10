cmake_minimum_required(VERSION 3.24)

set(
    OPUS_RUNTIME_TARGET_ARCH
    "auto"
    CACHE STRING
    "Target architecture for the OPUS native runtime: auto, arm64, x86_64, or universal"
)
set_property(
    CACHE OPUS_RUNTIME_TARGET_ARCH
    PROPERTY STRINGS auto arm64 x86_64 universal
)

if(APPLE)
    if(OPUS_RUNTIME_TARGET_ARCH STREQUAL "universal")
        set(
            CMAKE_OSX_ARCHITECTURES
            "arm64;x86_64"
            CACHE STRING
            "Architectures for OPUS native runtime"
            FORCE
        )
    elseif(
        OPUS_RUNTIME_TARGET_ARCH STREQUAL "arm64"
        OR OPUS_RUNTIME_TARGET_ARCH STREQUAL "x86_64"
    )
        set(
            CMAKE_OSX_ARCHITECTURES
            "${OPUS_RUNTIME_TARGET_ARCH}"
            CACHE STRING
            "Architectures for OPUS native runtime"
            FORCE
        )
    elseif(NOT OPUS_RUNTIME_TARGET_ARCH STREQUAL "auto")
        message(
            FATAL_ERROR
            "OPUS_RUNTIME_TARGET_ARCH must be auto, arm64, x86_64, or universal; "
            "got ${OPUS_RUNTIME_TARGET_ARCH}"
        )
    endif()
endif()

project(opus_runtime_native VERSION 0.1.0 LANGUAGES CXX)

include(CTest)

find_package(Java REQUIRED COMPONENTS Development)

if(NOT DEFINED JAVA_HOME OR "${JAVA_HOME}" STREQUAL "")
    get_filename_component(opus_runtime_javac_realpath
        "${Java_JAVAC_EXECUTABLE}"
        REALPATH
    )
    get_filename_component(opus_runtime_java_bin
        "${opus_runtime_javac_realpath}"
        DIRECTORY
    )
    get_filename_component(opus_runtime_java_home
        "${opus_runtime_java_bin}/.."
        ABSOLUTE
    )
    set(JAVA_HOME "${opus_runtime_java_home}")
endif()

if(NOT DEFINED ENV{JAVA_HOME} OR "$ENV{JAVA_HOME}" STREQUAL "")
    set(ENV{JAVA_HOME} "${JAVA_HOME}")
endif()

find_package(JNI REQUIRED COMPONENTS JVM)

add_library(opus-runtime SHARED
    src/runtime.cpp
)

target_compile_features(opus-runtime PRIVATE cxx_std_17)
target_include_directories(opus-runtime PRIVATE ${JNI_INCLUDE_DIRS})

add_executable(opus-jvm-remote-loader-target
    src/remote_jvm_target.cpp
)

target_compile_features(opus-jvm-remote-loader-target PRIVATE cxx_std_17)
target_include_directories(opus-jvm-remote-loader-target PRIVATE ${JNI_INCLUDE_DIRS})

if(TARGET JNI::JVM)
    target_link_libraries(opus-jvm-remote-loader-target PRIVATE JNI::JVM)
elseif(JNI_LIBRARIES)
    target_link_libraries(opus-jvm-remote-loader-target PRIVATE ${JNI_LIBRARIES})
else()
    message(FATAL_ERROR "JNI JVM library is required for the remote JVM target.")
endif()

if(APPLE)
    # `libopus-runtime.dylib` is loaded by an already-running JVM. Resolve JNI
    # symbols from that process at load time so an x86_64 slice can be built
    # with architecture-neutral JNI headers even when this host JDK is arm64.
    target_link_options(opus-runtime PRIVATE
        "-undefined"
        "dynamic_lookup"
    )
elseif(TARGET JNI::JVM)
    target_link_libraries(opus-runtime PRIVATE JNI::JVM)
elseif(JNI_LIBRARIES)
    target_link_libraries(opus-runtime PRIVATE ${JNI_LIBRARIES})
endif()

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(opus-runtime PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Werror
    )
    target_compile_options(opus-jvm-remote-loader-target PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Werror
    )
endif()

set_target_properties(opus-runtime PROPERTIES
    OUTPUT_NAME "opus-runtime"
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN YES
)

set_target_properties(opus-jvm-remote-loader-target PROPERTIES
    OUTPUT_NAME "java"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/remote-jvm-target"
)

set(opus_runtime_java_sources
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/main/java/dev/opus/runtime/harness/AttachHarnessMain.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/main/java/dev/opus/runtime/bridge/NativeRuntimeBridge.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/main/java/dev/opus/runtime/harness/AttachTargetHarness.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/main/java/dev/opus/runtime/harness/ControlledJvmHarness.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/main/java/dev/opus/runtime/harness/OwnedRuntimeHarness.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/main/java/dev/opus/runtime/harness/AuthorizedRuntimeTarget.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/owned-m3/java/dev/opus/runtime/harness/OwnedClientControlHarness.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/owned-m3/java/dev/opus/runtime/ownedclient/OpusOwnedM3RuntimeControl.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/owned-m3/java/dev/opus/runtime/ownedclient/OpusOwnedM3ClientBootstrap.java"
    "${CMAKE_CURRENT_SOURCE_DIR}/../runtime-java/src/test/java/org/polydevs/opusmc/bootstrap/ForgeBootstrapMain.java"
)
set(opus_runtime_java_classes "${CMAKE_CURRENT_BINARY_DIR}/java-classes")
set(opus_runtime_attach_harness_java_class
    "${opus_runtime_java_classes}/dev/opus/runtime/harness/AttachHarnessMain.class"
)
set(opus_runtime_attach_target_java_class
    "${opus_runtime_java_classes}/dev/opus/runtime/harness/AttachTargetHarness.class"
)
set(opus_runtime_controlled_java_class
    "${opus_runtime_java_classes}/dev/opus/runtime/harness/ControlledJvmHarness.class"
)
set(opus_runtime_owned_java_class
    "${opus_runtime_java_classes}/dev/opus/runtime/harness/OwnedRuntimeHarness.class"
)
set(opus_runtime_authorized_target_java_class
    "${opus_runtime_java_classes}/dev/opus/runtime/harness/AuthorizedRuntimeTarget.class"
)
set(opus_runtime_owned_client_control_harness_java_class
    "${opus_runtime_java_classes}/dev/opus/runtime/harness/OwnedClientControlHarness.class"
)
set(opus_runtime_java_warning_suppression_arguments
    -Xlint:-options
)

if(Java_VERSION VERSION_LESS "9")
    set(opus_runtime_java_compatibility_arguments
        -source 8
        -target 8
    )
else()
    set(opus_runtime_java_compatibility_arguments
        --release 8
    )
endif()

if(Java_VERSION VERSION_GREATER_EQUAL "17")
    set(opus_runtime_java_native_access_arguments
        "--enable-native-access=ALL-UNNAMED"
    )
endif()

add_custom_command(
    OUTPUT
        "${opus_runtime_attach_harness_java_class}"
        "${opus_runtime_attach_target_java_class}"
        "${opus_runtime_controlled_java_class}"
        "${opus_runtime_owned_java_class}"
        "${opus_runtime_authorized_target_java_class}"
        "${opus_runtime_owned_client_control_harness_java_class}"
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${opus_runtime_java_classes}"
    COMMAND "${Java_JAVAC_EXECUTABLE}"
        ${opus_runtime_java_compatibility_arguments}
        ${opus_runtime_java_warning_suppression_arguments}
        -d "${opus_runtime_java_classes}"
        ${opus_runtime_java_sources}
    DEPENDS ${opus_runtime_java_sources}
    COMMENT "Compiling the Attach, controlled-JVM, owned-target, authorized-target, and owned-client-control Java harnesses"
    VERBATIM
)

add_custom_target(opus-runtime-java-harness ALL
    DEPENDS
        "${opus_runtime_attach_harness_java_class}"
        "${opus_runtime_attach_target_java_class}"
        "${opus_runtime_controlled_java_class}"
        "${opus_runtime_owned_java_class}"
        "${opus_runtime_authorized_target_java_class}"
        "${opus_runtime_owned_client_control_harness_java_class}"
)

if(BUILD_TESTING)
    add_test(
        NAME opus-runtime-controlled-jvm
        COMMAND
            "${Java_JAVA_EXECUTABLE}"
            "-Xcheck:jni"
            ${opus_runtime_java_native_access_arguments}
            "-Dopus.runtime.library=$<TARGET_FILE:opus-runtime>"
            -cp "${opus_runtime_java_classes}"
            dev.opus.runtime.harness.ControlledJvmHarness
    )
    add_test(
        NAME opus-runtime-owned-client-control
        COMMAND
            "${Java_JAVA_EXECUTABLE}"
            "-Xcheck:jni"
            ${opus_runtime_java_native_access_arguments}
            "-Dopus.runtime.library=$<TARGET_FILE:opus-runtime>"
            -cp "${opus_runtime_java_classes}"
            dev.opus.runtime.harness.OwnedClientControlHarness
    )
endif()
