package dev.opus.runtime.harness;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * A non-cooperative Java process used to exercise the JDK Attach API transport.
 *
 * <p>It deliberately has no OPUS runtime-control descriptor or preloaded native
 * library. The only test coordination is readiness and stop marker files owned
 * by the integration script.</p>
 */
public final class AttachTargetHarness {
    private AttachTargetHarness() {
    }

    public static void main(String[] arguments) throws Exception {
        Options options = Options.parse(arguments);
        writeReadyMarker(options.readyFile);

        while (!options.stopFile.isFile()) {
            Thread.sleep(50L);
        }
    }

    private static void writeReadyMarker(File readyFile) throws IOException {
        FileOutputStream output = new FileOutputStream(readyFile);
        try {
            output.write("ready\n".getBytes(StandardCharsets.UTF_8));
            output.flush();
        } finally {
            output.close();
        }
    }

    private static final class Options {
        private final File readyFile;
        private final File stopFile;

        private Options(File readyFile, File stopFile) {
            this.readyFile = readyFile;
            this.stopFile = stopFile;
        }

        private static Options parse(String[] arguments) throws IOException {
            if (arguments.length != 4) {
                throw new IllegalArgumentException(
                    "Expected --ready-file <path> --stop-file <path>"
                );
            }
            File readyFile = null;
            File stopFile = null;
            for (int index = 0; index < arguments.length; index += 2) {
                String name = arguments[index];
                String value = arguments[index + 1];
                if (value.trim().isEmpty()) {
                    throw new IllegalArgumentException(
                        "Attach target file path must not be empty"
                    );
                }
                if ("--ready-file".equals(name) && readyFile == null) {
                    readyFile = new File(value).getCanonicalFile();
                } else if ("--stop-file".equals(name) && stopFile == null) {
                    stopFile = new File(value).getCanonicalFile();
                } else {
                    throw new IllegalArgumentException(
                        "Unsupported or duplicate Attach target option: " + name
                    );
                }
            }
            if (
                readyFile == null
                    || stopFile == null
                    || readyFile.getParentFile() == null
                    || !readyFile.getParentFile().isDirectory()
                    || stopFile.exists()
            ) {
                throw new IllegalArgumentException(
                    "Attach target marker paths are invalid"
                );
            }
            return new Options(readyFile, stopFile);
        }
    }
}
