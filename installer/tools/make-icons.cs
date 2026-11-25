using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

internal static class MakeIcons
{
    private static readonly int[] PngSizes = { 16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512 };
    private static readonly int[] IcoSizes = { 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 };

    private static void Main(string[] args)
    {
        string outDir = args.Length > 0 ? args[0] : ".";
        Directory.CreateDirectory(outDir);

        foreach (int size in PngSizes)
        {
            using (Bitmap bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb))
            {
                bitmap.SetResolution(96, 96);
                using (Graphics graphics = Graphics.FromImage(bitmap))
                {
                    graphics.SmoothingMode = SmoothingMode.HighQuality;
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    graphics.CompositingQuality = CompositingQuality.HighQuality;
                    graphics.Clear(Color.Transparent);

                    float scale = size / 32f;
                    using (GraphicsPath rounded = RoundedRectangle(0, 0, size, size, 9f * scale))
                    {
                        graphics.FillPath(Brushes.White, rounded);
                    }

                    using (Pen pen = new Pen(Color.FromArgb(11, 11, 12), 3f * scale))
                    {
                        pen.StartCap = LineCap.Round;
                        pen.EndCap = LineCap.Round;
                        pen.LineJoin = LineJoin.Round;
                        graphics.DrawLine(pen, 10f * scale, 23f * scale, 10f * scale, 9f * scale);
                        graphics.DrawLine(pen, 10f * scale, 9f * scale, 22f * scale, 23f * scale);
                        graphics.DrawLine(pen, 22f * scale, 23f * scale, 22f * scale, 9f * scale);
                    }
                }

                bitmap.Save(Path.Combine(outDir, "nova-" + size + ".png"), ImageFormat.Png);
            }
        }

        WriteIcon(Path.Combine(outDir, "nova.ico"), outDir, IcoSizes);
        Console.WriteLine("Logo assets ready in " + outDir);
    }

    private static GraphicsPath RoundedRectangle(float x, float y, float width, float height, float radius)
    {
        GraphicsPath path = new GraphicsPath();
        path.AddArc(x, y, radius, radius, 180, 90);
        path.AddArc(x + width - radius, y, radius, radius, 270, 90);
        path.AddArc(x + width - radius, y + height - radius, radius, radius, 0, 90);
        path.AddArc(x, y + height - radius, radius, radius, 90, 90);
        path.CloseFigure();
        return path;
    }

    private static void WriteIcon(string output, string dir, IList<int> sizes)
    {
        List<byte[]> images = new List<byte[]>();
        foreach (int size in sizes)
        {
            images.Add(File.ReadAllBytes(Path.Combine(dir, "nova-" + size + ".png")));
        }

        using (FileStream stream = new FileStream(output, FileMode.Create, FileAccess.Write))
        using (BinaryWriter writer = new BinaryWriter(stream))
        {
            writer.Write((ushort)0);
            writer.Write((ushort)1);
            writer.Write((ushort)sizes.Count);

            int offset = 6 + (16 * sizes.Count);
            for (int i = 0; i < sizes.Count; i += 1)
            {
                writer.Write(sizes[i] >= 256 ? (byte)0 : (byte)sizes[i]);
                writer.Write(sizes[i] >= 256 ? (byte)0 : (byte)sizes[i]);
                writer.Write((byte)0);
                writer.Write((byte)0);
                writer.Write((ushort)1);
                writer.Write((ushort)32);
                writer.Write((uint)images[i].Length);
                writer.Write((uint)offset);
                offset += images[i].Length;
            }

            foreach (byte[] image in images)
            {
                writer.Write(image);
            }
        }
    }
}
