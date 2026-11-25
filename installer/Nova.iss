#define AppName "Nova AI"
#define AppVersion "1.0.0"
#define AppExeName "Nova.exe"
#define AppId "{{A4E7D7C1-5F6B-4C3E-9B44-0F27C3D8E511}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Nova
DefaultDirName={localappdata}\{#AppName}
DefaultGroupName={#AppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
AllowNoIcons=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
OutputDir=..\dist
OutputBaseFilename=Nova-AI-Setup-v{#AppVersion}
SetupIconFile=assets\nova.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
MinVersion=10.0
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
VersionInfoDescription={#AppName} offline desktop installer
VersionInfoProductName={#AppName}
VersionInfoVersion={#AppVersion}

[Languages]
Name: english; MessagesFile: compiler:Default.isl

[Tasks]
Name: desktopicon; Description: Create a desktop shortcut; GroupDescription: Shortcuts:

[Files]
Source: "staging\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\nova.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\Microsoft.Web.WebView2.Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "staging\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "staging\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Comment: Open Nova AI
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\runtime\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; Parameters: "/silent /install"; Check: NeedsWebView2; Flags: waituntilterminated skipifdoesntexist
Filename: "{app}\{#AppExeName}"; Description: Launch {#AppName} now; Flags: nowait postinstall skipifsilent

[Code]
function NeedsWebView2(): Boolean;
var
  Installed: Boolean;
begin
  Installed :=
    RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}') or
    RegKeyExists(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}') or
    RegKeyExists(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}');
  Result := not Installed;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\workspace"
