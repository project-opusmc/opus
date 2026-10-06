package dev.opus.runtime.ownedclient;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * Source-controlled entry point for the OPUS-owned M3 preview profile.
 *
 * <p>It starts the narrow runtime-control endpoint and then delegates to the
 * unchanged legacy Forge bootstrap already selected by the OPUS launcher. The
 * legacy bootstrap remains the rollback game host; it is not the injected
 * payload entry point.</p>
 */
public final class OpusOwnedM3ClientBootstrap {
    private static final String LEGACY_BOOTSTRAP =
        "org.polydevs.opusmc.bootstrap.ForgeBootstrapMain";

    private OpusOwnedM3ClientBootstrap() {
    }

    public static void main(String[] args) throws Throwable {
        OpusOwnedM3RuntimeControl control =
            OpusOwnedM3RuntimeControl.startIfConfigured();
        try {
            invokeLegacyBootstrap(args);
        } finally {
            if (control != null) {
                control.close();
            }
        }
    }

    static void invokeLegacyBootstrap(String[] args) throws Throwable {
        try {
            Class<?> bootstrap = Class.forName(LEGACY_BOOTSTRAP);
            Method main = bootstrap.getMethod("main", String[].class);
            main.invoke(null, new Object[] {args});
        } catch (InvocationTargetException error) {
            throw error.getCause();
        }
    }
}
