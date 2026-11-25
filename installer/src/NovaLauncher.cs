using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace NovaDesktop
{
    internal static class Program
    {
        private static Mutex singleInstance;

        [STAThread]
        private static void Main()
        {
            bool created = false;
            singleInstance = new Mutex(true, "Local\\NovaAIDesktop_9gbh_2026", out created);
            if (!created)
            {
                MessageBox.Show(
                    "Nova AI is already running. Check the system tray.",
                    "Nova AI",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            GC.KeepAlive(singleInstance);
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly NotifyIcon trayIcon;
        private readonly Panel topBar;
        private readonly Panel loadingOverlay;
        private readonly PictureBox logoBox;
        private readonly Label titleLabel;
        private readonly Label statusLabel;
        private readonly Label loadingLabel;
        private readonly WebView2 webView;
        private readonly Button bingButton;
        private readonly Button browserButton;
        private readonly Button restartButton;
        private readonly Button exitButton;
        private readonly string appDir;
        private readonly string logPath;
        private readonly object logLock = new object();

        private BackgroundWorker worker;
        private Process serverProcess;
        private int port = 4173;
        private string appUrl = "http://localhost:4173";
        private bool webViewReady;
        private bool serverReady;
        private bool forceNavigate;
        private bool exiting;
        private bool suppressRestart;
        private bool webViewFailedShown;
        private int crashCount;

        public MainForm()
        {
            appDir = Application.StartupPath;
            string workspace = Path.Combine(appDir, "workspace");
            Directory.CreateDirectory(workspace);
            logPath = Path.Combine(workspace, "desktop-launcher.log");

            Text = "Nova AI";
            Size = new Size(1200, 800);
            MinimumSize = new Size(900, 600);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.Sizable;
            BackColor = Color.FromArgb(8, 9, 10);
            ForeColor = Color.FromArgb(240, 240, 240);
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            webView.DefaultBackgroundColor = Color.FromArgb(8, 9, 10);
            webView.CoreWebView2InitializationCompleted += WebView_CoreWebView2InitializationCompleted;
            webView.NavigationCompleted += WebView_NavigationCompleted;
            Controls.Add(webView);

            loadingOverlay = new Panel();
            loadingOverlay.Dock = DockStyle.Fill;
            loadingOverlay.BackColor = Color.FromArgb(8, 9, 10);
            loadingLabel = new Label();
            loadingLabel.Dock = DockStyle.Fill;
            loadingLabel.BackColor = Color.FromArgb(8, 9, 10);
            loadingLabel.ForeColor = Color.FromArgb(200, 204, 210);
            loadingLabel.Font = new Font("Segoe UI", 14F, FontStyle.Regular, GraphicsUnit.Point);
            loadingLabel.TextAlign = ContentAlignment.MiddleCenter;
            loadingLabel.Text = "Shuru ho raha hai…";
            loadingOverlay.Controls.Add(loadingLabel);
            Controls.Add(loadingOverlay);

            topBar = new Panel();
            topBar.Dock = DockStyle.Top;
            topBar.Height = 64;
            topBar.BackColor = Color.FromArgb(12, 13, 15);

            logoBox = new PictureBox();
            logoBox.Size = new Size(34, 34);
            logoBox.Location = new Point(12, 15);
            logoBox.SizeMode = PictureBoxSizeMode.Zoom;
            logoBox.BackColor = Color.Transparent;
            try
            {
                Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("NovaLogo.png");
                if (resource != null)
                {
                    logoBox.Image = Image.FromStream(resource);
                }
            }
            catch
            {
                // Installer icon still carries the same logo if the embedded PNG is unavailable.
            }

            titleLabel = new Label();
            titleLabel.Text = string.Empty;
            titleLabel.Visible = false;

            statusLabel = new Label();
            statusLabel.Text = "Starting local service…";
            statusLabel.Location = new Point(56, 22);
            statusLabel.Size = new Size(420, 20);
            statusLabel.ForeColor = Color.FromArgb(150, 156, 164);

            bingButton = MakeButton("Bing Login", 690);
            bingButton.Size = new Size(96, 36);
            browserButton = MakeButton("Browser", 800);
            restartButton = MakeButton("Restart", 940);
            exitButton = MakeButton("Exit", 1080);
            bingButton.Click += BingButton_Click;
            browserButton.Click += BrowserButton_Click;
            restartButton.Click += RestartButton_Click;
            exitButton.Click += ExitButton_Click;

            topBar.Controls.Add(logoBox);
            topBar.Controls.Add(titleLabel);
            topBar.Controls.Add(statusLabel);
            topBar.Controls.Add(bingButton);
            topBar.Controls.Add(browserButton);
            topBar.Controls.Add(restartButton);
            topBar.Controls.Add(exitButton);
            Controls.Add(topBar);

            trayIcon = new NotifyIcon();
            trayIcon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            trayIcon.Text = "Nova AI";
            trayIcon.Visible = true;
            trayIcon.DoubleClick += TrayIcon_DoubleClick;
            trayIcon.ContextMenu = new ContextMenu(new[]
            {
                new MenuItem("Open Nova", TrayIcon_DoubleClick),
                new MenuItem("Bing login", BingButton_Click),
                new MenuItem("Restart service", RestartButton_Click),
                new MenuItem("-"),
                new MenuItem("Exit", ExitButton_Click),
            });

            FormClosing += MainForm_FormClosing;
            Application.ApplicationExit += Application_ApplicationExit;

            try
            {
                webView.EnsureCoreWebView2Async();
            }
            catch (Exception error)
            {
                WebViewFailed(error.Message);
            }

            StartWorker(false);
        }

        private Button MakeButton(string text, int x)
        {
            Button button = new Button();
            button.Text = text;
            button.Location = new Point(x, 13);
            button.Size = new Size(78, 36);
            button.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = Color.FromArgb(70, 72, 76);
            button.BackColor = Color.FromArgb(24, 25, 27);
            button.ForeColor = Color.FromArgb(240, 240, 240);
            button.Cursor = Cursors.Hand;
            return button;
        }

        private void WebView_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                WebViewFailed(e.InitializationException == null ? "WebView2 runtime missing." : e.InitializationException.Message);
                return;
            }

            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.NewWindowRequested += WebView_NewWindowRequested;
            webView.CoreWebView2.ProcessFailed += (s, failed) =>
            {
                WriteLog("WebView2 process failed — app window recover kar raha hai.");
                try
                {
                    BeginInvoke(new MethodInvoker(() =>
                    {
                        statusLabel.Text = "App window recover ho raha hai…";
                    }));
                }
                catch
                {
                    // Form already closing.
                }
            };
            webViewReady = true;
            TryNavigate();
        }

        private void WebView_NewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            try
            {
                Process.Start(e.Uri);
            }
            catch
            {
                // External link could not be opened; app window stays intact.
            }
        }

        private void WebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (e.IsSuccess)
            {
                loadingOverlay.Visible = false;
                statusLabel.Text = "Ready";
            }
        }

        private void WebViewFailed(string message)
        {
            WriteLog("WebView2 unavailable: " + message);
            webViewReady = false;
            loadingOverlay.Visible = false;
            statusLabel.Text = "App browser unavailable — browser fallback";
            if (!webViewFailedShown)
            {
                webViewFailedShown = true;
                OpenUrl();
                MessageBox.Show(
                    this,
                    "Nova app window needs WebView2. Setup installs it automatically; meanwhile Nova opened in your browser.",
                    "Nova AI",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
        }

        private void TryNavigate()
        {
            if (!webViewReady || !serverReady || webView.CoreWebView2 == null)
            {
                return;
            }

            if (forceNavigate || !string.Equals(webView.CoreWebView2.Source, appUrl, StringComparison.OrdinalIgnoreCase))
            {
                webView.CoreWebView2.Navigate(appUrl);
                forceNavigate = false;
            }

            loadingOverlay.Visible = false;
            statusLabel.Text = "Ready";
        }

        private void StartWorker(bool restart)
        {
            if (worker != null && worker.IsBusy)
            {
                return;
            }

            statusLabel.Text = restart ? "Restarting local service…" : "Starting local service…";
            loadingOverlay.Visible = true;
            loadingLabel.Text = restart ? "Service restart ho raha hai…" : "Shuru ho raha hai…";
            // Restart par page reload mat karein — video job chalte hue refresh loop ban jata tha.
            if (restart)
            {
                suppressRestart = true;
                crashCount = 0;
            }

            worker = new BackgroundWorker();
            worker.DoWork += Worker_DoWork;
            worker.RunWorkerCompleted += Worker_RunWorkerCompleted;
            worker.RunWorkerAsync(restart);
        }

        private void Worker_DoWork(object sender, DoWorkEventArgs e)
        {
            bool restart = e.Argument is bool && (bool)e.Argument;
            WriteLog("Launcher start. Restart=" + restart.ToString());

            if (restart)
            {
                StopServer();
                port = 4173;
                appUrl = "http://localhost:" + port.ToString(CultureInfo.InvariantCulture);
            }

            if (IsHealthy(appUrl))
            {
                WriteLog("Existing Nova service answered at " + appUrl);
                return;
            }

            if (IsPortOpen(port))
            {
                port = FindFreePort();
                appUrl = "http://localhost:" + port.ToString(CultureInfo.InvariantCulture);
                WriteLog("Port 4173 busy; switched to " + port.ToString(CultureInfo.InvariantCulture));
            }

            StartServer(port);

            for (int attempt = 0; attempt < 80; attempt += 1)
            {
                if (IsHealthy(appUrl))
                {
                    WriteLog("Nova service ready at " + appUrl);
                    return;
                }

                if (serverProcess != null && serverProcess.HasExited)
                {
                    throw new IOException("Nova service stopped during startup. See desktop-launcher.log.");
                }

                Thread.Sleep(500);
            }

            throw new TimeoutException("Nova service did not become ready in time. See desktop-launcher.log.");
        }

        private void Worker_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
        {
            if (e.Error != null)
            {
                serverReady = false;
                loadingOverlay.Visible = false;
                statusLabel.Text = "Startup failed";
                WriteLog("ERROR: " + e.Error.Message);
                MessageBox.Show(this, e.Error.Message, "Nova AI", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            serverReady = true;
            suppressRestart = false;
            crashCount = 0;
            TryNavigate();
            trayIcon.ShowBalloonTip(3000, "Nova AI", "Ready.", ToolTipIcon.Info);
        }

        private void StartServer(int selectedPort)
        {
            string nodePath = Path.Combine(appDir, "runtime", "node.exe");
            string serverPath = Path.Combine(appDir, "server.js");
            string envPath = Path.Combine(appDir, ".env");

            if (!File.Exists(nodePath))
            {
                throw new FileNotFoundException("Bundled runtime is missing: " + nodePath);
            }

            if (!File.Exists(serverPath))
            {
                throw new FileNotFoundException("Nova server is missing: " + serverPath);
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = nodePath;
            startInfo.Arguments = Quote(serverPath);
            startInfo.WorkingDirectory = appDir;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;

            ApplyEnvFile(startInfo, envPath);
            startInfo.EnvironmentVariables["PORT"] = selectedPort.ToString(CultureInfo.InvariantCulture);
            startInfo.EnvironmentVariables["NOVA_DESKTOP"] = "1";
            suppressRestart = false;

            serverProcess = new Process();
            serverProcess.StartInfo = startInfo;
            serverProcess.EnableRaisingEvents = true;
            serverProcess.OutputDataReceived += Server_OutputDataReceived;
            serverProcess.ErrorDataReceived += Server_OutputDataReceived;
            serverProcess.Exited += Server_Exited;
            serverProcess.Start();
            serverProcess.BeginOutputReadLine();
            serverProcess.BeginErrorReadLine();
        }

        private static void ApplyEnvFile(ProcessStartInfo startInfo, string envPath)
        {
            if (!File.Exists(envPath))
            {
                return;
            }

            foreach (string rawLine in File.ReadAllLines(envPath))
            {
                string line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith("#"))
                {
                    continue;
                }

                int separator = line.IndexOf('=');
                if (separator < 1)
                {
                    continue;
                }

                string key = line.Substring(0, separator).Trim();
                string value = line.Substring(separator + 1).Trim();
                if (value.Length >= 2 &&
                    ((value.StartsWith("\"") && value.EndsWith("\"")) ||
                     (value.StartsWith("'") && value.EndsWith("'"))))
                {
                    value = value.Substring(1, value.Length - 2);
                }

                if (key.Length > 0)
                {
                    startInfo.EnvironmentVariables[key] = value;
                }
            }
        }

        private void Server_OutputDataReceived(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                WriteLog("[nova] " + e.Data);
            }
        }

        private void Server_Exited(object sender, EventArgs e)
        {
            int code = -1;
            Process process = sender as Process;
            if (process != null)
            {
                try { code = process.ExitCode; }
                catch { }
            }

            WriteLog("Nova service process exited. Code=" + code.ToString(CultureInfo.InvariantCulture));
            if (exiting || suppressRestart || (worker != null && worker.IsBusy))
            {
                return;
            }

            crashCount += 1;
            if (crashCount > 2)
            {
                WriteLog("Too many unexpected exits; automatic restart stopped.");
                return;
            }

            BeginInvoke(new MethodInvoker(RestartAfterCrash));
        }

        private void RestartAfterCrash()
        {
            statusLabel.Text = "Service restarted automatically…";
            StartWorker(true);
        }

        private static bool IsHealthy(string baseUrl)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(baseUrl + "/api/health");
                request.Method = "GET";
                request.Timeout = 900;
                request.ReadWriteTimeout = 900;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return (int)response.StatusCode == 200;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool IsPortOpen(int selectedPort)
        {
            TcpClient client = new TcpClient();
            try
            {
                client.Connect("127.0.0.1", selectedPort);
                return true;
            }
            catch
            {
                return false;
            }
            finally
            {
                client.Close();
            }
        }

        private static int FindFreePort()
        {
            TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int freePort = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return freePort;
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private void WriteLog(string message)
        {
            try
            {
                lock (logLock)
                {
                    File.AppendAllText(
                        logPath,
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) + " " + message + Environment.NewLine);
                }
            }
            catch
            {
                // Logging must never break the launcher.
            }
        }

        private void OpenUrl()
        {
            try
            {
                Process.Start(appUrl);
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "Browser could not be opened: " + error.Message, "Nova AI", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void StopServer()
        {
            suppressRestart = true;
            if (serverProcess == null)
            {
                return;
            }

            try
            {
                if (!serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(5000);
                }
            }
            catch
            {
                // Process may already be gone.
            }
            finally
            {
                serverProcess = null;
            }
        }

        private void BingButton_Click(object sender, EventArgs e)
        {
            if (!serverReady)
            {
                MessageBox.Show(this, "Nova local service abhi ready nahi hai. Thoda wait karke dobara dabayein.", "Nova AI", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(appUrl + "/api/browser-login");
                request.Method = "POST";
                request.ContentLength = 0;
                request.Timeout = 20000;
                request.ReadWriteTimeout = 20000;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if ((int)response.StatusCode != 200)
                    {
                        throw new IOException("Bing login tabs open nahi hue.");
                    }
                }

                statusLabel.Text = "Bing login tab opened — ek baar sign in karein";
                trayIcon.ShowBalloonTip(3000, "Nova AI", "Bing login tab opened. Sign in once; profile save ho jayega.", ToolTipIcon.Info);
            }
            catch (Exception error)
            {
                MessageBox.Show(this, error.Message, "Nova AI", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void BrowserButton_Click(object sender, EventArgs e)
        {
            OpenUrl();
        }

        private void RestartButton_Click(object sender, EventArgs e)
        {
            StartWorker(true);
        }

        private void ExitButton_Click(object sender, EventArgs e)
        {
            exiting = true;
            StopServer();
            trayIcon.Visible = false;
            Application.Exit();
        }

        private void TrayIcon_DoubleClick(object sender, EventArgs e)
        {
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
            if (webViewReady && serverReady)
            {
                TryNavigate();
            }
            else if (!webViewReady)
            {
                OpenUrl();
            }
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (exiting || e.CloseReason == CloseReason.ApplicationExitCall)
            {
                return;
            }

            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                Hide();
                trayIcon.ShowBalloonTip(2500, "Nova AI", "Nova is still running in the tray.", ToolTipIcon.Info);
            }
        }

        private void Application_ApplicationExit(object sender, EventArgs e)
        {
            StopServer();
            if (webView != null)
            {
                webView.Dispose();
            }
            if (trayIcon != null)
            {
                trayIcon.Dispose();
            }
        }
    }
}
