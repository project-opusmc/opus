package org.polydevs.opusmc.bootstrap;

import java.io.File;

/**
 * CMake-only stand-in for the unchanged legacy Forge bootstrap.
 *
 * <p>The source-controlled OPUS-owned preview wrapper invokes this class in
 * the control-transport harness so the injector can verify the exact preview
 * process identity. It is test source only and is never packaged into either
 * the preview JAR or the legacy Runtime artifact.</p>
 */
public final class ForgeBootstrapMain {
    private ForgeBootstrapMain() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 2 || !"--opus-owned-m3-harness-release".equals(args[0])) {
            throw new IllegalArgumentException(
                "The OPUS-owned M3 control harness requires its release marker"
            );
        }

        File releaseMarker = new File(args[1]).getCanonicalFile();
        System.out.println("[OPUS/M3-OWNED-HARNESS] legacy target active");
        System.out.flush();
        for (int attempt = 0; attempt < 1200; attempt++) {
            if (releaseMarker.isFile()) {
                return;
            }
            Thread.sleep(25L);
        }
        throw new IllegalStateException(
            "The OPUS-owned M3 control harness did not receive its release marker"
        );
    }
}
