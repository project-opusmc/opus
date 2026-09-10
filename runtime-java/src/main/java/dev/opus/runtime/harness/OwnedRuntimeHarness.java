package dev.opus.runtime.harness;

import dev.opus.runtime.bridge.NativeRuntimeBridge;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.List;

/**
 * An injector-owned JVM target used only to exercise the M3 lifecycle
 * contract. It is not a Minecraft client and it never targets another
 * process.
 */
public final class OwnedRuntimeHarness {
    private static final int PROTOCOL_VERSION = 1;
    private static final String NATIVE_RUNTIME_VERSION = "0.1.0";
    private static final String JAVA_RUNTIME_VERSION = "not-built";
    private static final String MAPPING_SCHEMA_VERSION = "not-applicable";
    private static final String ONECONFIG_ADAPTER_VERSION = "not-loaded";
    private static final String ARTIFACT_CHECKSUMS = "not-packaged";
    private static final String LOAD_COMMAND_PREFIX = "load ";

    private OwnedRuntimeHarness() {
    }

    public static void main(String[] args) throws IOException {
        String injectorVersion = requiredProperty("opus.injector.version");
        String targetArchitecture = normalizeArchitecture(
            System.getProperty("os.arch")
        );

        emit(
            "OPUS_OWNED_TARGET_LISTENING "
                + "protocolVersion=" + PROTOCOL_VERSION
                + ";injectorVersion=" + injectorVersion
                + ";targetArchitecture=" + targetArchitecture
                + ";state=waiting"
        );

        BufferedReader commands = new BufferedReader(
            new InputStreamReader(System.in, "UTF-8")
        );
        boolean runtimeLoaded = false;
        boolean shutdownComplete = true;
        String loadedLibrary = null;
        String command;
        while ((command = commands.readLine()) != null) {
            if (command.startsWith(LOAD_COMMAND_PREFIX)) {
                String library = command.substring(
                    LOAD_COMMAND_PREFIX.length()
                );
                if (library.trim().isEmpty()) {
                    emit("OPUS_OWNED_TARGET_ERROR reason=missing_runtime_path");
                    continue;
                }

                String requestedLibrary = new File(library).getAbsolutePath();
                String probe;
                if (!runtimeLoaded) {
                    System.load(requestedLibrary);
                    runtimeLoaded = true;
                    loadedLibrary = requestedLibrary;
                    probe = NativeRuntimeBridge.probe();
                } else if (!shutdownComplete) {
                    emit("OPUS_OWNED_TARGET_ERROR reason=runtime_already_running");
                    continue;
                } else if (!loadedLibrary.equals(requestedLibrary)) {
                    emit("OPUS_OWNED_TARGET_ERROR reason=runtime_path_mismatch");
                    continue;
                } else {
                    probe = NativeRuntimeBridge.restart();
                }
                requireTokens(
                    probe,
                    Arrays.asList(
                        "runtime_version=" + NATIVE_RUNTIME_VERSION,
                        "vm_discovery=ok",
                        "jni=ok",
                        "jvmti=ok",
                        "worker_attach_detach=ok",
                        "state=running"
                    )
                );
                shutdownComplete = false;
                emit(
                    lifecycleReport(
                        "OPUS_OWNED_TARGET_READY ",
                        injectorVersion,
                        targetArchitecture,
                        "running"
                    )
                );
            } else if ("unload".equals(command)) {
                if (!runtimeLoaded || shutdownComplete) {
                    emit("OPUS_OWNED_TARGET_ERROR reason=runtime_not_running");
                    continue;
                }

                String shutdown = NativeRuntimeBridge.shutdown();
                requireTokens(
                    shutdown,
                    Arrays.asList("shutdown=ok", "state=stopped", "workers=0")
                );
                emit(
                    lifecycleReport(
                        "OPUS_OWNED_TARGET_UNLOADED ",
                        injectorVersion,
                        targetArchitecture,
                        "stopped"
                    )
                );
                shutdownComplete = true;
            } else if ("exit".equals(command)) {
                if (runtimeLoaded && !shutdownComplete) {
                    emit("OPUS_OWNED_TARGET_ERROR reason=shutdown_required");
                    continue;
                }
                emit(
                    lifecycleReport(
                        "OPUS_OWNED_TARGET_EXIT ",
                        injectorVersion,
                        targetArchitecture,
                        "stopped"
                    )
                );
                return;
            } else {
                emit("OPUS_OWNED_TARGET_ERROR reason=unsupported_command");
            }
        }

        if (runtimeLoaded && !shutdownComplete) {
            throw new IllegalStateException(
                "Owned target input closed before native shutdown"
            );
        }
    }

    private static String lifecycleReport(
        String prefix,
        String injectorVersion,
        String targetArchitecture,
        String state
    ) {
        return prefix
            + "protocolVersion=" + PROTOCOL_VERSION
            + ";injectorVersion=" + injectorVersion
            + ";nativeRuntimeVersion=" + NATIVE_RUNTIME_VERSION
            + ";javaRuntimeVersion=" + JAVA_RUNTIME_VERSION
            + ";targetArchitecture=" + targetArchitecture
            + ";mappingSchemaVersion=" + MAPPING_SCHEMA_VERSION
            + ";oneConfigAdapterVersion=" + ONECONFIG_ADAPTER_VERSION
            + ";artifactChecksums=" + ARTIFACT_CHECKSUMS
            + ";state=" + state;
    }

    private static String requiredProperty(String property) {
        String value = System.getProperty(property);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException("Missing -D" + property);
        }
        return value;
    }

    private static String normalizeArchitecture(String architecture) {
        if ("amd64".equals(architecture) || "x86_64".equals(architecture)) {
            return "x86_64";
        }
        if ("aarch64".equals(architecture) || "arm64".equals(architecture)) {
            return "arm64";
        }
        throw new IllegalStateException("Unsupported target architecture: " + architecture);
    }

    private static void emit(String value) {
        System.out.println(value);
        System.out.flush();
    }

    private static void requireTokens(String report, List<String> requiredTokens) {
        for (String token : requiredTokens) {
            if (!report.contains(token)) {
                throw new IllegalStateException(
                    "Native runtime report is missing " + token + ": " + report
                );
            }
        }
    }
}
