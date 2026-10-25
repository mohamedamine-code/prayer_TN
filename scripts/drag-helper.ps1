param(
  [string]$Action = 'drag',          # drag | click | rect
  [string]$Title = 'Salati Widget',
  [int]$Dx = 0,
  [int]$Dy = 0,
  [int]$Steps = 14,
  [int]$PID_OF_APP = 0,
  [int]$CssW = 0,                    # exact CSS dimensions from CDP (GetWindowRect lies on layered windows)
  [int]$CssH = 0,
  [int]$X = -999999,                 # exact window position from CDP (used to find the HWND)
  [int]$Y = -999999
)
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public static IntPtr FindByTitleAndPid(string title, int wantPid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != (uint)wantPid) return true;
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(256);
      GetWindowText(h, sb, 256);
      if (sb.ToString() == title) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static IntPtr FindByPosition(int pid, int x, int y) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint wpid; GetWindowThreadProcessId(h, out wpid);
      if (wpid != (uint)pid) return true;
      if (!IsWindowVisible(h)) return true;
      RECT r; GetWindowRect(h, out r);
      if (Math.Abs(r.Left - x) <= 4 && Math.Abs(r.Top - y) <= 4) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
[int]$wantPid = $PID_OF_APP
if (-not $wantPid) { throw 'PID_OF_APP required' }
[Win32]::SetProcessDPIAware() | Out-Null
$h = [IntPtr]::Zero
if ($X -gt -900000 -and $Y -gt -900000) {
  $h = [Win32]::FindByPosition($wantPid, $X, $Y)
} else {
  $h = [Win32]::FindByTitleAndPid($Title, $wantPid)
}
if ($h -eq [IntPtr]::Zero) { Write-Output 'NOTFOUND'; exit 1 }
$r = New-Object Win32+RECT
[Win32]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("rect: {0},{1} - {2},{3} (w={4} h={5})" -f $r.Left, $r.Top, $r.Right, $r.Bottom, ($r.Right - $r.Left), ($r.Bottom - $r.Top))

if ($Action -eq 'rect') { exit 0 }

$w = $r.Right - $r.Left
$hgt = $r.Bottom - $r.Top
if ($CssW -gt 0) { $w = $CssW }
if ($CssH -gt 0) { $hgt = $CssH }
# Where is the dock tab inside the window? Collapsed: it fills the window.
# Expanded: pinned to one edge - assume bottom-edge expansion (tab at bottom).
$tabTop = 0
if ($hgt -gt 100) { $tabTop = $hgt - 56 }
if ($Action -eq 'click') {
  # Chevron centre inside the tab (+36 px from tab top)
  $cx = [int]($r.Left + $w / 2)
  $cy = [int]($r.Top + $tabTop + 36)
} else {
  # Moon area of the drag tab (+13 px from tab top)
  $cx = [int]($r.Left + $w / 2)
  $cy = [int]($r.Top + $tabTop + 13)
}
[Win32]::SetCursorPos($cx, $cy) | Out-Null
Start-Sleep -Milliseconds 120
[Win32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)  # LEFTDOWN
Start-Sleep -Milliseconds 110
for ($i = 1; $i -le $Steps; $i++) {
  $t = $i / $Steps
  $eased = 1 - [Math]::Pow(1 - $t, 2)
  [Win32]::SetCursorPos(([int]($cx + $Dx * $eased)), ([int]($cy + $Dy * $eased))) | Out-Null
  Start-Sleep -Milliseconds 22
}
Start-Sleep -Milliseconds 140
[Win32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)  # LEFTUP
Start-Sleep -Milliseconds 100
Write-Output "done drag($Dx,$Dy)"
Start-Sleep -Milliseconds 900
[Win32]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("after: {0},{1} - {2},{3} (w={4} h={5})" -f $r.Left, $r.Top, $r.Right, $r.Bottom, ($r.Right - $r.Left), ($r.Bottom - $r.Top))
