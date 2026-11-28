using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Management;
using System.Net;
using System.Text.RegularExpressions;
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
        private readonly Panel loadingOverlay;
        private readonly Label loadingLabel;
        private readonly WebView2 webView;
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
        private bool videoFullscreen;
        private FormWindowState normalWindowState = FormWindowState.Normal;
        private FormBorderStyle normalBorderStyle = FormBorderStyle.Sizable;
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

            trayIcon = new NotifyIcon();
            trayIcon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            trayIcon.Text = "Nova AI";
            trayIcon.Visible = true;
            trayIcon.DoubleClick += TrayIcon_DoubleClick;
            trayIcon.ContextMenu = new ContextMenu(new[]
            {
                new MenuItem("Open Nova", TrayIcon_DoubleClick),
                new MenuItem("Open in browser", BrowserButton_Click),
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

        private void WebView_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                WebViewFailed(e.InitializationException == null ? "WebView2 runtime missing." : e.InitializationException.Message);
                return;
            }

            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.NewWindowRequested += WebView_NewWindowRequested;
            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            webView.CoreWebView2.ContainsFullScreenElementChanged += WebView_ContainsFullScreenElementChanged;
            webView.CoreWebView2.ProcessFailed += (s, failed) =>
            {
                WriteLog("WebView2 process failed — app window recover kar raha hai.");
            };
            webViewReady = true;
            TryNavigate();
        }

        private void WebView_ContainsFullScreenElementChanged(object sender, object e)
        {
            bool entering = false;
            try
            {
                entering = webView.CoreWebView2.ContainsFullScreenElement;
            }
            catch
            {
                return;
            }

            try
            {
                BeginInvoke(new MethodInvoker(() =>
                {
                    if (entering && !videoFullscreen)
                    {
                        normalWindowState = WindowState;
                        normalBorderStyle = FormBorderStyle;
                        videoFullscreen = true;
                        FormBorderStyle = FormBorderStyle.None;
                        WindowState = FormWindowState.Maximized;
                        webView.BringToFront();
                    }
                    else if (!entering && videoFullscreen)
                    {
                        videoFullscreen = false;
                        WindowState = normalWindowState;
                        FormBorderStyle = normalBorderStyle;
                    }
                }));
            }
            catch
            {
                // Form already closing — ignore fullscreen transition.
            }
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

        private static string JsonString(string value)
        {
            return "\"" + (value ?? string.Empty)
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n") + "\"";
        }

        private void SendWebMessage(string json)
        {
            try
            {
                if (webView.CoreWebView2 != null)
                {
                    webView.CoreWebView2.PostWebMessageAsJson(json);
                }
            }
            catch (Exception error)
            {
                WriteLog("Web message send failed: " + error.Message);
            }
        }

        private void WebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string raw = e.WebMessageAsJson;
            try
            {
                BeginInvoke(new MethodInvoker(() => HandleWebMessage(raw)));
            }
            catch
            {
                // Form already closing — ignore the picker request.
            }
        }

        private void HandleWebMessage(string raw)
        {
            Match typeMatch = Regex.Match(raw, "\"type\"\\s*:\\s*\"([^\"]+)\"");
            Match idMatch = Regex.Match(raw, "\"requestId\"\\s*:\\s*\"([^\"]+)\"");
            if (!typeMatch.Success || !idMatch.Success) return;

            string type = typeMatch.Groups[1].Value;
            string requestId = idMatch.Groups[1].Value;

            if (type == "choose-folder")
            {
                using (FolderBrowserDialog dialog = new FolderBrowserDialog())
                {
                    dialog.Description = "Choose a folder Nova can read and code in";
                    dialog.ShowNewFolderButton = true;
                    if (dialog.ShowDialog(this) == DialogResult.OK)
                    {
                        SendWebMessage("{\"type\":\"folderChosen\",\"requestId\":" + JsonString(requestId)
                            + ",\"path\":" + JsonString(dialog.SelectedPath) + "}");
                    }
                    else
                    {
                        SendWebMessage("{\"type\":\"folderChosen\",\"requestId\":" + JsonString(requestId)
                            + ",\"cancelled\":true}");
                    }
                }
                return;
            }

            if (type == "choose-file" || type == "choose-files")
            {
                using (OpenFileDialog dialog = new OpenFileDialog())
                {
                    dialog.Title = type == "choose-files" ? "Choose video clips" : "Choose a file";
                    dialog.Filter = "Video and audio|*.mp4;*.mkv;*.webm;*.mov;*.avi;*.m4v;*.mp3;*.wav;*.aac;*.flac;*.m4a|All files|*.*";
                    dialog.Multiselect = type == "choose-files";
                    dialog.CheckFileExists = true;
                    if (dialog.ShowDialog(this) == DialogResult.OK)
                    {
                        if (dialog.Multiselect)
                        {
                            List<string> parts = new List<string>();
                            foreach (string file in dialog.FileNames) parts.Add(JsonString(file));
                            SendWebMessage("{\"type\":\"filesChosen\",\"requestId\":" + JsonString(requestId)
                                + ",\"paths\":[" + string.Join(",", parts) + "]}");
                        }
                        else
                        {
                            SendWebMessage("{\"type\":\"fileChosen\",\"requestId\":" + JsonString(requestId)
                                + ",\"path\":" + JsonString(dialog.FileName) + "}");
                        }
                    }
                    else
                    {
                        SendWebMessage("{\"type\":\"" + (type == "choose-files" ? "filesChosen" : "fileChosen")
                            + "\",\"requestId\":" + JsonString(requestId) + ",\"cancelled\":true}");
                    }
                }
            }
        }

        private void WebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (e.IsSuccess)
            {
                loadingOverlay.Visible = false;
            }
        }

        private void WebViewFailed(string message)
        {
            WriteLog("WebView2 unavailable: " + message);
            webViewReady = false;
            loadingOverlay.Visible = false;
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
        }

        private void StartWorker(bool restart)
        {
            if (worker != null && worker.IsBusy)
            {
                return;
            }

            WriteLog(restart ? "Restarting local service." : "Starting local service.");
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
            WriteLog("Service restarted automatically.");
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

        // App band karte hi Nova ke apne ChatGPT / Bing browsers band kar do.
        // User ka normal Chrome bilkul safe rehta hai — sirf Nova profile wali
        // Chrome processes close hoti hain.
        private void CloseNovaBrowsers()
        {
            // 1) Server se graceful close (CDP Browser.close) — profile crash-mark nahi hota.
            try
            {
                string endpoint = "http://127.0.0.1:" + port.ToString(CultureInfo.InvariantCulture) + "/api/app-exit";
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(endpoint);
                request.Method = "POST";
                request.ContentLength = 0;
                request.Timeout = 4000;
                request.ReadWriteTimeout = 4000;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    // Sirf graceful close ka signal — response body ki zaroorat nahi.
                }
                WriteLog("Nova browsers closed through the local service.");
            }
            catch (Exception error)
            {
                WriteLog("Browser close request failed: " + error.Message);
            }

            // 2) Fallback — Nova profile wali Chrome/Edge processes force-close.
            try
            {
                string workspace = Path.Combine(appDir, "workspace");
                string[] profiles =
                {
                    Path.Combine(workspace, ".chatgpt-profile"),
                    Path.Combine(workspace, ".arena-profile"),
                    Path.Combine(workspace, ".browser-profile"),
                    Path.Combine(workspace, ".bing-headless-profile"),
                };
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='chrome.exe' OR Name='msedge.exe'"))
                {
                    foreach (ManagementObject item in searcher.Get())
                    {
                        string commandLine = item["CommandLine"] as string;
                        if (string.IsNullOrEmpty(commandLine))
                        {
                            continue;
                        }

                        bool ours = false;
                        foreach (string profile in profiles)
                        {
                            if (commandLine.IndexOf(profile, StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                ours = true;
                                break;
                            }
                        }
                        if (!ours)
                        {
                            continue;
                        }

                        object rawId = item["ProcessId"];
                        if (rawId == null)
                        {
                            continue;
                        }
                        int processId = Convert.ToInt32(rawId, CultureInfo.InvariantCulture);
                        WriteLog("Closing Nova browser process " + processId.ToString(CultureInfo.InvariantCulture));
                        KillProcessTree(processId);
                    }
                }
            }
            catch (Exception error)
            {
                WriteLog("Browser process cleanup failed: " + error.Message);
            }
        }

        private static void KillProcessTree(int processId)
        {
            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo();
                startInfo.FileName = "taskkill";
                startInfo.Arguments = "/PID " + processId.ToString(CultureInfo.InvariantCulture) + " /T /F";
                startInfo.UseShellExecute = false;
                startInfo.CreateNoWindow = true;
                startInfo.RedirectStandardOutput = true;
                startInfo.RedirectStandardError = true;
                using (Process killer = Process.Start(startInfo))
                {
                    if (killer != null)
                    {
                        killer.WaitForExit(5000);
                    }
                }
            }
            catch
            {
                // Best effort — process already gone ho sakta hai.
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
            CloseNovaBrowsers();
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
            CloseNovaBrowsers();
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
