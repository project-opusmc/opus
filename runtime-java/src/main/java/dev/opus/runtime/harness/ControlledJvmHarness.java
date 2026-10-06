package dev.opus.runtime.harness;

import dev.opus.runtime.bridge.NativeRuntimeBridge;
import java.io.File;
import java.util.Arrays;
import java.util.List;

/**
 * A controlled Java process used to verify the native runtime's JVM lifecycle.
 *
 * <p>This is intentionally not a Minecraft launcher or an injector. CTest
 * supplies the absolute path of the library that it just built.</p>
 */
public final class ControlledJvmHarness {
    private ControlledJvmHarness() {
    }

    public static void main(String[] args) {
        String library = System.getProperty("opus.runtime.library");
        if (library == null || library.trim().isEmpty()) {
            throw new IllegalStateException("Missing -Dopus.runtime.library");
        }

        System.load(new File(library).getAbsolutePath());

        String probe = NativeRuntimeBridge.probe();
        requireTokens(
            probe,
            Arrays.asList(
                "runtime_version=0.1.0",
                "vm_discovery=ok",
                "jni=ok",
                "jvmti=ok",
                "worker_attach_detach=ok",
                "state=running"
            )
        );

        String shutdown = NativeRuntimeBridge.shutdown();
        requireTokens(
            shutdown,
            Arrays.asList("shutdown=ok", "state=stopped", "workers=0")
        );

        String afterShutdownProbe = NativeRuntimeBridge.probe();
        requireTokens(
            afterShutdownProbe,
            Arrays.asList("state=error", "reason=runtime_stopped")
        );

        String restart = NativeRuntimeBridge.restart();
        requireTokens(
            restart,
            Arrays.asList(
                "runtime_version=0.1.0",
                "vm_discovery=ok",
                "jni=ok",
                "jvmti=ok",
                "worker_attach_detach=ok",
                "state=running"
            )
        );

        String finalShutdown = NativeRuntimeBridge.shutdown();
        requireTokens(
            finalShutdown,
            Arrays.asList("shutdown=ok", "state=stopped", "workers=0")
        );

        System.out.println("OPUS_CONTROLLED_JVM_PROBE " + probe);
        System.out.println("OPUS_CONTROLLED_JVM_SHUTDOWN " + shutdown);
        System.out.println("OPUS_CONTROLLED_JVM_AFTER_SHUTDOWN " + afterShutdownProbe);
        System.out.println("OPUS_CONTROLLED_JVM_RESTART " + restart);
        System.out.println("OPUS_CONTROLLED_JVM_FINAL_SHUTDOWN " + finalShutdown);
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
