function Build-CompositeTree {
    param([hashtable]$rule, [string]$className)
    $lines = [System.Collections.ArrayList]::new()
    
    function Walk { param($obj, [int]$d = 0)
        if ($d -gt 12 -or $null -eq $obj) { return }
        $p = "  " * $d
        if ($obj -is [hashtable]) {
            $oc = $obj['pxObjClass']
            if ($oc -eq "Embed-Harness-Section") {
                [void]$script:lines.Add("${p}[SECTION:$($obj['pySectionId'])] title='$($obj['pyTitle'])' container=$($obj['pyContainerType']) tabbed=$($obj['pyTabbedHeader'])")
                if ($obj['pySectionBody'] -is [array]) { foreach ($b in $obj['pySectionBody']) { Walk $b ($d+1) } }
            } elseif ($oc -eq "Embed-Harness-SectionBody") {
                $bt=$obj['pyBodyType']; $inc=$obj['pyInclude']; $up=$obj['pyUsingPage']; $pl=$obj['pyPageListProperty']; $plc=$obj['pyPageListPropertyClass']
                if ($inc) { [void]$script:lines.Add("${p}[INCLUDE] '$inc'$(if($up){" page=$up"})") }
                elseif ($pl) { [void]$script:lines.Add("${p}[REPEAT] list='$pl' class='$plc'") }
                elseif ($bt) { [void]$script:lines.Add("${p}[BODY:$bt]") }
                if ($obj['pyTable'] -is [hashtable]) { Walk $obj['pyTable'] ($d+1) }
                foreach ($k in @('pyRows','pyCells')) { if ($obj[$k] -is [array]) { foreach ($i in $obj[$k]) { Walk $i ($d+1) } } }
            } elseif ($oc -eq "Embed-Display-Table") {
                $fmt=$obj['pyLayoutFormatType']; $cols=$obj['pyColumnCount']
                if ($fmt) { [void]$script:lines.Add("${p}[LAYOUT:$fmt cols=$cols]") }
                if ($obj['pyRows'] -is [array]) { foreach ($row in $obj['pyRows']) { Walk $row ($d+1) } }
            } elseif ($oc -eq "Embed-Display-Table-Row") {
                if ($obj['pyCells'] -is [array]) { foreach ($cell in $obj['pyCells']) { Walk $cell ($d+1) } }
            } elseif ($oc -eq "Embed-Display-Table-Cell") {
                $type=$obj['pyType']; $val=$obj['pyValue']; $fmt=$obj['pyFormat']; $ro=$obj['pyReadOnly']
                if ($val -and $val.StartsWith('.')) { [void]$script:lines.Add("${p}$(if($ro -eq 'true'){'R'}else{'W'}) FIELD $val fmt=$fmt") }
                elseif ($type -eq 'SUB_SECTION' -and $val) { [void]$script:lines.Add("${p}[SUB] '$val'") }
                elseif ($type -eq 'LABEL' -and $val -and $val.Length -lt 50) { [void]$script:lines.Add("${p}[LBL] '$val'") }
                elseif ($type -eq 'BUTTON') { [void]$script:lines.Add("${p}[BTN] '$val'") }
                elseif ($type -eq 'LAYOUT') { foreach ($k in $obj.Keys) { if ($obj[$k] -is [hashtable] -and $obj[$k]['pxObjClass']) { Walk $obj[$k] ($d+1) } } }
            }
        } elseif ($obj -is [array]) { foreach ($item in $obj) { Walk $item $d } }
    }
    
    [void]$lines.Add("[$className::RuleForm]  layout=$($rule['pyLayoutType'])")
    $pacs = $rule['pyPagesAndClasses']
    if ($pacs) { foreach ($pac in $pacs) { if ($pac -is [hashtable] -and $pac['pyPagesAndClassesClass']) { [void]$lines.Add("  context: page='$($pac['pyPagesAndClassesPage'])' class='$($pac['pyPagesAndClassesClass'])'") } } }
    if ($rule['pySections'] -is [array]) { foreach ($sec in $rule['pySections']) { Walk $sec 1 } }
    return $lines
}

$files = @(
    @{c="Data-Admin-Operator-ID"; f="C:\projects\kiro\SDLC-Agents-4-Enterprise\documents\SA4E-95\ruleform-operator-id-raw.json"},
    @{c="Rule-Obj-Model"; f="C:\projects\kiro\SDLC-Agents-4-Enterprise\documents\SA4E-95\harnesses\Rule-Obj-Model.json"},
    @{c="Rule-Obj-When"; f="C:\projects\kiro\SDLC-Agents-4-Enterprise\documents\SA4E-95\harnesses\Rule-Obj-When.json"},
    @{c="Rule-Declare-DecisionTable"; f="C:\projects\kiro\SDLC-Agents-4-Enterprise\documents\SA4E-95\harnesses\Rule-Declare-DecisionTable.json"},
    @{c="Rule-Obj-Report-Definition"; f="C:\projects\kiro\SDLC-Agents-4-Enterprise\documents\SA4E-95\harnesses\Rule-Obj-Report-Definition.json"},
    @{c="Rule-Connect-REST"; f="C:\projects\kiro\SDLC-Agents-4-Enterprise\documents\SA4E-95\harnesses\Rule-Connect-REST.json"}
)

$allOutput = ""
foreach ($entry in $files) {
    $json = Get-Content $entry.f -Raw
    if ($json.StartsWith('"')) { $json = $json | ConvertFrom-Json }
    $rule = $json | ConvertFrom-Json -AsHashtable
    $tree = Build-CompositeTree -rule $rule -className $entry.c
    $allOutput += "`n" + ($tree -join "`n") + "`n"
}
$allOutput
