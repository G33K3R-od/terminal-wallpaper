# System stats for Terminal Dashboard wallpaper (Wallpaper Engine).
# Run: .\collect-stats.ps1  — keep window open while wallpaper is active.

$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

# Only one collector instance (task + manual start share this lock).
$script:StatsMutex = $null
$script:StatsMutexOwned = $false
try {
    $script:StatsMutex = New-Object System.Threading.Mutex($true, 'Local\TerminalDashboardStats', [ref]$script:StatsMutexOwned)
    if (-not $script:StatsMutexOwned) {
        exit 0
    }
} catch {
    exit 0
}

$outFile = Join-Path $PSScriptRoot 'stats.json'
$intervalSec = 2

function Get-PrimaryResolution {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        return '{0}x{1}' -f $b.Width, $b.Height
    } catch {
        return '1920x1080'
    }
}

function Get-PrimaryGpu {
    $cards = Get-CimInstance Win32_VideoController | Where-Object { $_.Name }
    $discrete = $cards | Where-Object {
        $_.Name -notmatch 'Microsoft|Basic|Remote|Virtual|Parsec|Moonlight'
    } | Select-Object -First 1
    if ($discrete) { return $discrete.Name.Trim() }
    return ($cards | Select-Object -First 1).Name
}

function Get-PrimaryIPv4 {
    $cfg = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        Select-Object -First 1
    if ($cfg -and $cfg.IPv4Address) {
        return ($cfg.IPv4Address | Select-Object -First 1).IPAddress
    }
    return (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -First 1).IPAddress
}

$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

function Format-BytesGiB([long]$bytes) {
    '{0:N2} GiB' -f ($bytes / 1GB), $InvariantCulture
}

function Get-CpuPct {
    try {
        $sample = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction Stop
        [math]::Round($sample.CounterSamples.CookedValue)
    } catch {
        $null
    }
}

function Get-GpuNvidiaStats {
    if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
        return $null
    }
    $out = & nvidia-smi --query-gpu=temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>$null
    if (-not $out) {
        return $null
    }
    $parts = ($out.ToString().Trim() -split ',') | ForEach-Object { $_.Trim() }
    if ($parts.Count -lt 2) {
        return $null
    }
    @{
        gpuTemp = [int]$parts[0]
        gpuPct  = [int]$parts[1]
    }
}

function Get-WifiName {
    $profile = Get-NetConnectionProfile -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|WLAN|Wireless' } |
        Select-Object -First 1
    if ($profile -and $profile.Name) {
        return [string]$profile.Name
    }
    $null
}

function Get-AllDisks {
    $result = @()
    $disks = Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue |
        Where-Object { $_.DriveType -eq 3 }
    foreach ($disk in $disks) {
        $total = [long]$disk.Size
        $used = $total - [long]$disk.FreeSpace
        $pct = if ($total) { [math]::Round(100 * $used / $total) } else { 0 }
        $result += @{
            id    = [string]$disk.DeviceID
            label = if ($disk.VolumeName) { [string]$disk.VolumeName } else { [string]$disk.DeviceID }
            used  = Format-BytesGiB $used
            total = Format-BytesGiB $total
            pct   = $pct
        }
    }
    return $result
}

function Get-OsCaptionEnglish {
    $reg = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $caption = if ($reg -and $reg.ProductName) { [string]$reg.ProductName } else { [string]$os.Caption }
    $caption = $caption -replace '^(Microsoft)\s+', ''

    if ($caption -match '[\u0400-\u04FF]' -and $reg) {
        $edition = switch -Regex ([string]$reg.EditionID) {
            'Professional' { 'Pro' }
            'Home'         { 'Home' }
            'Enterprise'   { 'Enterprise' }
            'Education'    { 'Education' }
            default        { [string]$reg.EditionID }
        }
        $displayVer = if ($reg.DisplayVersion) { [string]$reg.DisplayVersion } else { [string]$os.Version }
        $caption = "Windows $displayVer $edition".Trim()
    }

    if ($os -and $os.OSArchitecture -match '64') {
        if ($caption -notmatch '64\s*bit') { $caption += ' [64 bits]' }
    }
    $caption.Trim()
}

function Collect-Stats {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
    $boot = $os.LastBootUpTime
    $uptime = (Get-Date) - $boot
    $uptimeStr = '{0} hours {1} minutes {2} seconds' -f
        [int]$uptime.TotalHours,
        $uptime.Minutes,
        $uptime.Seconds

    $totalRam = [long]$cs.TotalPhysicalMemory
    $freeRam = [long]$os.FreePhysicalMemory * 1024
    $usedRam = $totalRam - $freeRam
    $ramPct = if ($totalRam) { [math]::Round(100 * $usedRam / $totalRam) } else { 0 }

    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
    if (-not $disk) {
        $disk = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object -First 1
    }
    $diskUsed = if ($disk) { $disk.Size - $disk.FreeSpace } else { 0 }
    $diskTotal = if ($disk) { $disk.Size } else { 1 }
    $diskPct = if ($diskTotal) { [math]::Round(100 * $diskUsed / $diskTotal) } else { 0 }

    $osCaption = Get-OsCaptionEnglish

    $shellVer = 'PowerShell v' + $PSVersionTable.PSVersion
    $cpuPct = Get-CpuPct
    $gpuStats = Get-GpuNvidiaStats
    $wifi = Get-WifiName
    $allDisks = Get-AllDisks

    $result = [ordered]@{
        os          = $osCaption
        host        = $env:COMPUTERNAME
        kernel      = [string]$os.Version
        motherboard = ('{0} {1}' -f $board.Manufacturer, $board.Product).Trim()
        uptime      = $uptimeStr
        shell       = $shellVer
        resolution  = Get-PrimaryResolution
        cpu         = ($cpu.Name -replace '\s+', ' ').Trim()
        gpu         = Get-PrimaryGpu
        memory      = '{0} / {1} ({2}%)' -f (Format-BytesGiB $usedRam), (Format-BytesGiB $totalRam), $ramPct
        memoryPct   = $ramPct
        disk        = '{0} / {1} ({2}%)' -f (Format-BytesGiB $diskUsed), (Format-BytesGiB $diskTotal), $diskPct
        diskPct     = $diskPct
        ip          = (Get-PrimaryIPv4)
        username    = $env:USERNAME
        disks       = $allDisks
        updated     = (Get-Date -Format 'o')
    }

    if ($null -ne $cpuPct) {
        $result.cpuPct = $cpuPct
        $result.cpuUsage = '{0}%' -f $cpuPct
    }
    if ($wifi) {
        $result.wifi = $wifi
    }
    if ($gpuStats) {
        $result.gpuTemp = $gpuStats.gpuTemp
        $result.gpuPct = $gpuStats.gpuPct
    }

    $result
}

if ($MyInvocation.InvocationName -ne '.') {
    Write-Host 'Terminal Dashboard - stats collector' -ForegroundColor Cyan
    Write-Host "Writing to: $outFile"
    Write-Host "Interval: ${intervalSec}s. Close window to stop."
    Write-Host ''

    while ($true) {
        try {
            $data = Collect-Stats
            $json = $data | ConvertTo-Json -Compress -Depth 5
            [System.IO.File]::WriteAllText($outFile, $json, [Text.UTF8Encoding]::new($false))
        } catch {
            Write-Host "Error: $_" -ForegroundColor Red
        }
        Start-Sleep -Seconds $intervalSec
    }
}
