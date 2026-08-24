import org.lwjgl.LWJGLException;
import org.lwjgl.opengl.Display;
import org.lwjgl.opengl.DisplayMode;
import org.lwjgl.opengl.GL11;

public final class GlProbe {
    public static void main(String[] args) throws Exception {
        System.out.println("probe start thread=" + Thread.currentThread().getName());
        Display.setDisplayMode(new DisplayMode(320, 240));
        try {
            Display.create();
            System.out.println("created=" + Display.isCreated());
            System.out.println("vendor=" + GL11.glGetString(GL11.GL_VENDOR));
            System.out.println("renderer=" + GL11.glGetString(GL11.GL_RENDERER));
            System.out.println("version=" + GL11.glGetString(GL11.GL_VERSION));
            System.out.println("fbo=" + GL11.glGetError());
            Display.update();
            Thread.sleep(1000L);
        } catch (LWJGLException failure) {
            failure.printStackTrace();
        } finally {
            if (Display.isCreated()) {
                Display.destroy();
            }
        }
    }
}
