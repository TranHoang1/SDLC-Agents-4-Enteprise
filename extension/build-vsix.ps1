# build-vsix.ps1 — Build VSIX manually without relying on vsce hooks
# Run this from: c:\projects\kiro\SDLC-Agents-4-Enterprise\extension\
param(
    [string]$OutputPath = ".\sdlc-agents-4-enterprise-1.16.0.vsix"
)

$extDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg = Get-Content "$extDir\package.json" | ConvertFrom-Json
$version = $pkg.version
$name = $pkg.name
$publisher = $pkg.publisher
$vsixName = "$name-$version.vsix"
$vsixPath = Join-Path $extDir $vsixName

Write-Host "Building $vsixName..."
if (Test-Path $vsixPath) { Remove-Item $vsixPath -Force }

# Read .vscodeignore patterns
$ignorePatterns = @()
if (Test-Path "$extDir\.vscodeignore") {
    $ignorePatterns = Get-Content "$extDir\.vscodeignore" | Where-Object { $_ -and $_ -notmatch '^\s*#' }
}

# Collect all files relative to extension dir
$allFiles = Get-ChildItem $extDir -Recurse -File | Where-Object {
    $relPath = $_.FullName.Substring($extDir.Length + 1).Replace('\','/')
    # Skip the output vsix itself
    if ($relPath -like "*.vsix") { return $false }
    # Apply vscodeignore patterns
    foreach ($pattern in $ignorePatterns) {
        $p = $pattern.Trim()
        if (-not $p) { continue }
        if ($relPath -like $p) { return $false }
        # Handle ** globs simply
        $pSimple = $p -replace '\*\*/', '' -replace '\*\*', ''
        if ($pSimple -and $relPath -like "*$pSimple*") { return $false }
    }
    return $true
}

Write-Host "Total files to include: $($allFiles.Count)"

# Create VSIX (which is a zip with specific structure)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($vsixPath, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)

# Add [Content_Types].xml
$contentTypes = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="css" ContentType="text/css"/>
  <Default Extension="html" ContentType="text/html"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Default Extension="map" ContentType="application/octet-stream"/>
  <Default Extension="ts" ContentType="text/plain"/>
</Types>
'@
$entry = $zip.CreateEntry("[Content_Types].xml")
$writer = New-Object System.IO.StreamWriter($entry.Open())
$writer.Write($contentTypes)
$writer.Close()

# Build vsixmanifest
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="$name" Version="$version" Publisher="$publisher"/>
    <DisplayName>$($pkg.displayName)</DisplayName>
    <Description xml:space="preserve">$($pkg.description)</Description>
    <Tags>$($pkg.keywords -join ',')</Tags>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <License>extension/LICENSE.txt</License>
    <Icon>extension/resources/icon.png</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
$( $allFiles | ForEach-Object {
    $relPath = $_.FullName.Substring($extDir.Length + 1).Replace('\','/')
    "    <Asset Type=`"Microsoft.VisualStudio.Services.Content.Details`" Path=`"extension/$relPath`" Addressable=`"true`"/>"
})
  </Assets>
</PackageManifest>
"@
$entry = $zip.CreateEntry("extension.vsixmanifest")
$writer = New-Object System.IO.StreamWriter($entry.Open())
$writer.Write($manifest)
$writer.Close()

# Add all extension files
foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($extDir.Length + 1).Replace('\','/')
    $entryName = "extension/$relPath"
    $entry = $zip.CreateEntry($entryName)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$zip.Dispose()
$stream.Close()

$sizeMB = [math]::Round((Get-Item $vsixPath).Length / 1MB, 2)
Write-Host "DONE Packaged: $vsixPath ($sizeMB MB)"
