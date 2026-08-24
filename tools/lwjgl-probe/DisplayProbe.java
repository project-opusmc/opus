import org.lwjgl.opengl.Display;
import org.lwjgl.opengl.DisplayMode;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.PixelFormat;

public final class DisplayProbe {
    public static void main(String[] args) throws Exception {
        System.out.println("thread=" + Thread.currentThread().getName());
        Display.setResizable(true);
        Display.setTitle("Opus Probe");
        Display.setDisplayMode(new DisplayMode(640, 480));
        Display.create(new PixelFormat().withDepthBits(24));
        System.out.println("created=" + Display.isCreated());
        System.out.println("version=" + GL11.glGetString(GL11.GL_VERSION));
        System.out.println("renderer=" + GL11.glGetString(GL11.GL_RENDERER));
        int list = GL11.glGenLists(1);
        System.out.println("list=" + list + " error=" + GL11.glGetError());
        Display.destroy();
    }
}
