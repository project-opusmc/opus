cmake_minimum_required(VERSION 3.24)

set(
    OPUS_TRANSPORT_TARGET_ARCH
    "auto"
    CACHE STRING
    "Target architecture for the OPUS macOS transport helper: auto, arm64, or x86_64"
)
set_property(
    CACHE OPUS_TRANSPORT_TARGET_ARCH
    PROPERTY STRINGS auto arm64 x86_64
)

if(NOT APPLE)
    message(FATAL_ERROR "The OPUS native transport helper is defined only for macOS.")
endif()

if(
    OPUS_TRANSPORT_TARGET_ARCH STREQUAL "arm64"
    OR OPUS_TRANSPORT_TARGET_ARCH STREQUAL "x86_64"
)
    set(
        CMAKE_OSX_ARCHITECTURES
        "${OPUS_TRANSPORT_TARGET_ARCH}"
        CACHE STRING
        "Architectures for the OPUS macOS transport helper"
        FORCE
    )
elseif(NOT OPUS_TRANSPORT_TARGET_ARCH STREQUAL "auto")
    message(
        FATAL_ERROR
        "OPUS_TRANSPORT_TARGET_ARCH must be auto, arm64, or x86_64; "
        "got ${OPUS_TRANSPORT_TARGET_ARCH}"
    )
endif()

project(opus_macos_transport VERSION 0.1.0 LANGUAGES CXX ASM)

if(OPUS_TRANSPORT_TARGET_ARCH STREQUAL "arm64")
    set(opus_remote_loader_bootstrap_source
        src/macos_loader_bootstrap_arm64.S
    )
elseif(OPUS_TRANSPORT_TARGET_ARCH STREQUAL "x86_64")
    set(opus_remote_loader_bootstrap_source
        src/macos_loader_bootstrap_x86_64.S
    )
elseif(CMAKE_OSX_ARCHITECTURES STREQUAL "arm64" OR CMAKE_SYSTEM_PROCESSOR MATCHES "arm64|aarch64")
    set(opus_remote_loader_bootstrap_source
        src/macos_loader_bootstrap_arm64.S
    )
elseif(CMAKE_OSX_ARCHITECTURES STREQUAL "x86_64" OR CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|amd64")
    set(opus_remote_loader_bootstrap_source
        src/macos_loader_bootstrap_x86_64.S
    )
else()
    message(FATAL_ERROR "Unable to select an OPUS remote-loader bootstrap architecture.")
endif()

add_executable(opus-macos-transport
    src/macos_transport.cpp
    ${opus_remote_loader_bootstrap_source}
)

target_compile_features(opus-macos-transport PRIVATE cxx_std_17)

add_executable(opus-task-port-probe-target
    src/task_port_probe_target.cpp
)

target_compile_features(opus-task-port-probe-target PRIVATE cxx_std_17)

add_library(opus-remote-loader-probe SHARED
    src/remote_loader_probe.cpp
)

target_compile_features(opus-remote-loader-probe PRIVATE cxx_std_17)

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(opus-macos-transport PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Werror
    )
    target_compile_options(opus-task-port-probe-target PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Werror
    )
    target_compile_options(opus-remote-loader-probe PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Werror
    )
endif()

set_target_properties(opus-macos-transport PROPERTIES
    OUTPUT_NAME "opus-macos-transport"
)

set_target_properties(opus-task-port-probe-target PROPERTIES
    OUTPUT_NAME "opus-task-port-probe-target"
)

set_target_properties(opus-remote-loader-probe PROPERTIES
    OUTPUT_NAME "opus-remote-loader-probe"
)
