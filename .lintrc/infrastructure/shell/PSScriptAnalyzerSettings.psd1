@{
    # PSScriptAnalyzer 配置
    # 参考：https://github.com/PowerShell/PSScriptAnalyzer

    IncludeDefaultRules = $true

    Rules = @{

        # ── 格式化规则 ──────────────────────────────────────────────

        PSAvoidLongLines = @{
            Enable            = $true
            MaximumLineLength = 100
        }

        PSPlaceOpenBrace = @{
            Enable             = $true
            OnSameLine         = $true
            NewLineAfter       = $true
            IgnoreOneLineBlock = $true
        }

        PSPlaceCloseBrace = @{
            Enable             = $true
            NewLineAfter       = $true
            IgnoreOneLineBlock = $true
            NoEmptyLineBefore  = $false
        }

        PSUseConsistentIndentation = @{
            Enable                          = $true
            Kind                            = 'space'
            PipelineIndentation             = 'IncreaseIndentationAfterEveryPipeline'
            IndentationSize                 = 4
        }

        PSUseConsistentWhitespace = @{
            Enable                                  = $true
            CheckInnerBrace                         = $true
            CheckOpenBrace                          = $true
            CheckOpenParen                          = $true
            CheckOperator                           = $true
            CheckPipe                               = $true
            CheckPipeForRedundantWhitespace         = $true
            CheckSeparator                          = $true
            CheckParameter                           = $true
            IgnoreAssignmentOperatorInsideHashTable = $false
        }

        PSUseCorrectCasing = @{
            Enable = $true
        }

        # ── 命名与安全规则 ──────────────────────────────────────────

        PSAvoidUsingCmdletAliases = @{
            Enable    = $true
            AllowList = @()  # 不允许任何别名（ls/dir/cat 等全部禁止）
        }

        PSAvoidUsingPositionalParameters = @{
            Enable = $true
        }

        # ── 兼容性规则 ──────────────────────────────────────────────

        PSUseCompatibleSyntax = @{
            Enable         = $true
            TargetVersions = @('7.4', '7.2', '5.1')
        }

        PSUseCompatibleCmdlets = @{
            Compatibility = @('core-6.1.0-windows', 'desktop-5.1.14393.206-windows')
        }

        PSUseCompatibleCommands = @{
            Enable          = $true
            TargetProfiles  = @(
                'win-8_x64_10.0.14393.0_5.1.14393.2791_x64_4.0.30319.42000_framework',
                'win-8_x64_10.0.17763.0_5.1.17763.316_x64_4.0.30319.42000_framework',
                'ubuntu_x64_22.04_7.4.0_x64_dotnet_7.0.0'
            )
        }

        PSUseCompatibleTypes = @{
            Enable          = $true
            TargetProfiles  = @(
                'win-8_x64_10.0.14393.0_5.1.14393.2791_x64_4.0.30319.42000_framework',
                'ubuntu_x64_22.04_7.4.0_x64_dotnet_7.0.0'
            )
        }
    }

    ExcludeRules = @(
        # 无排除项 — 所有规则均启用
    )
}
