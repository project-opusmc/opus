package dev.opus.runtime.bridge;

/**
 * The only Java-side JNI declaration owned by the M3 native lifecycle
 * boundary.
 *
 * <p>An authorized target bootstrap must load {@code libopus-runtime.dylib}
 * before calling this bridge. Client adapters and feature modules must use
 * higher-level APIs; they must not declare their own native entry points.</p>
 */
public final class NativeRuntimeBridge {
    private NativeRuntimeBridge() {
    }

    public static native String probe();

    public static native String shutdown();

    public static native String restart();
}
