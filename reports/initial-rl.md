# 2026-10-25 RL 执行结果

当前到达简报允许的决策节点：T1 通过，T2 部分通过，T3 正式短训练效果未通过，T4 的完整 rollout 与合成视频尚未取得。已保留可继续使用的实现、参考、checkpoint、真实轨迹、独立评分和曲线。

## 验收结果

| 任务 | 结果 | 主要证据 |
|---|---|---|
| T1 初始化与驱动 | 通过 | 新参考连续 497 步、0 reset、数值有限；右/左关节中位 0.00947/0.00847 rad，腕 9.26/5.82 mm，各指中位 9.50–16.95 mm |
| T2 首帧及序列优化 | 部分通过 | 六任务共 5252 手帧五指全部低于 0.7 倍终止门槛；全局中位 3.6046→3.2840 mm；5/12 手中位增加 0.035–0.974 mm，严格逐手不变差要求未过 |
| T3 参考前馈加 PPO 残差 | 实现与等价验证通过，训练效果未过 | 零残差 497 步指令差最大 8.94e-6；1024 环境、500 epoch 实际完成；末 100 轮平均 episode 15.80 步，frame0 运行 30/497 步后对象位置失败 |
| T4 完整链及评分 | 完整链未过，短轨迹已评分 | 原视频 16/249 帧有实际状态，完整 GT 判定失败；可用前缀的 ATE/ARE/RTE/RRE 已保存；完整视频未生成 |

T1 新参考的物体中位位置误差为右 146.44、左 36.92 mm，本阶段按简报只报告对象误差。T1 的连续全段诊断保留原失败记录并抑制自动 reset；T3 正式训练和评估沿用原奖励与终止。

T3 最后 100 轮的 6.89% 成功率来自原 RSI 随机起点训练分布；固定第 0 帧完整评估失败。失败 episode 中对象位置占 77.68%、对象旋转占 39.97%，同一次失败可包含多项原因。正式策略和零残差基线均在 30 步结束，右物体误差 58.415 mm 越过原 58.309 mm 门槛。

进一步对比两条真实轨迹：两物体在全部 60 个物理前采样和 30 个控制后采样中的 13 维刚体状态逐位完全相同。右物体实际位移约 `[+0.54, -0.24, -0.27]` mm，参考位移约 `[-14.15, -20.02, +52.69]` mm，实际物体仍基本停在桌上。PPO 原始残差绝对值均值 0.237、最大 0.890，实际 residual=2×raw 的误差为 0；手部目标和状态确有变化。该证据把当前失败定位到物体运动未被接触控制带起来；本轮未找到动作未应用或缩放错误的确定实现 bug。

最终审计另记录一个既有移植差异：当前 tracking 指数课程在 3200 控制步截断，上游持续收紧；当前最终对象门槛约 25.11 mm，相同步数的上游约 20.005 mm。当前设置较宽松，本轮按保持原奖励/终止的约定保留它。详情及五指记录通道为 0 N 的证据范围见 `t3/REPORT.md`、`final_causal_verdict.json`；未进行传感器正接触校准，核心判断采用真实物体状态对比。

## 改动与开关

所有源码路径以 `sources/EgoMatrix/RL/` 为本地根，以远端 `source/EgoMatrix/RL/` 为实际执行根。

| 文件 | 本轮新增选择 | 默认及方法归属 |
|---|---|---|
| `egomatrix_rl/utils/physics_profile.py`、`env_config.py` | `env.xhand_physics_profile=stable_contact_v1`：关闭单手自碰撞、Kp20/Kd1、手/物体/桌 depenetration 上限 1 m/s | 默认 `legacy`；论文未给数值，属于通用物理修复 |
| `retarget.py`、`egomatrix_rl/retargeting/optimizer.py` | `--first-frame-iterations 3000`、`--reverse-pass-from <forward_native.pkl>` | 默认 0/空，沿用原流程；原目标与权重保持，新增通用预算与反向初始化 |
| `egomatrix_rl/retargeting/io.py` | `EGOMATRIX_RETARGET_ROOT` | 默认原路径；用于独立参考树和来源记录 |
| `egomatrix_rl/env.py`、`utils/reference_control.py`、`env_config.py` | `--base-action-source reference`；`reference_wrist_kp/kd/kr/kw=400/40/20/1` | 默认 `policy`；参考前馈为简报授权的通用控制实验 |
| `utils/runtime_config.py`、`train.py`、`evaluate.py` | checkpoint 继承所选控制、物理、参考配置；`--log-root`；评估 `--deterministic`、`--trajectory-output` | 显式参数优先；记录真实输入与状态 |

上表中的 `utils/` 均位于 `egomatrix_rl/` 下。上采样复用原 `--upsample-table-repair-iterations 1200` 开关。T3 使用原 residual×2、奖励、终止和训练课程。T4 新入口 `claude_work/t4/run_t4.py`、`run_t4.sh` 复用既有独立评分与合成脚本。

ManipTrans 核查得到：Kp500/Kd30、depenetration1000；未加载 imitator checkpoint 时 base action 为 0。其 `self_collision=False` 最终进入 Isaac Gym `filter=0`，需按碰撞过滤位解释。本轮关闭自碰撞与参考前馈均在报告中标为新增通用选择。

## 已执行的验证

- 积分前静态碰撞几何与首个 PhysX 子步交叉验证，定位 reset 自穿和双手互穿。首子步自碰撞达约 12 mm、2560 N，双手互穿 25.28 mm、725 N；限速配置完成全段稳定诊断。
- 六任务实际 RL loader 全帧审计、原 table clearance 校验、完整 forward/reverse 同目标评分；全部 12 手按整条同目标选 reverse。
- 参考动作批量映射/缩放、四元数计算测试和 checkpoint 配置继承检查通过；497 步 oracle 指令等价检查通过。
- 16 环境接口小运行和正式 1024 环境/500 epoch 自动链均实际完成，退出码 0；checkpoint、环境配置、参考来源和状态轨迹齐备。
- 曲线与物理误差图已实际查看。独立 GT 只在最终评分阶段读取。

## 结果位置

远端根 `R=项目根目录`，`W=$R/claude_work`，实际账号 `研究账号`。

- T1：`t1/REPORT.md`、`t1/SELECTED_REFERENCE_ORACLE.md`、原始 JSON 与误差图。
- T2：`t2/T2_REPORT.md`、`audit_selected_bidirectional.json`、`bidirectional_selection.json`、`changes.patch`。
- 最终新参考：远端 `$W/t2/retarget_selected_bidirectional`；实际 loader 导出 `$W/t2/actual_reference_selected_bidirectional/<task>/actual_rl_reference.npz`。旧参考与两个完整方向的候选均保留。
- T3：`t3/REPORT.md`、`T3_ACCEPTANCE.json`、`curves/training_curves.png`、`source_snapshot/t3_changes.patch`。
- 正式运行：远端 `$W/t3/TACO_task0-0_formal_20261025T114501Z/`，含完整日志、checkpoint、参数、实际 reference 和轨迹。本地 `t3/formal500_evaluation/` 已保存真实轨迹及元数据。
- T4：`t4/formal500_prefix_score/REPORT.md`、`summary.json`、`independent_GT_transfer.json`、`t4/PAPER_INITIAL_GRASP_DYNAMICS_AUDIT.md`。
- 可接续入口：`t3/run_t3.sh`、`t4/run_t4.sh`；当前没有启动下一轮训练。

## 需要的研究决策

1. **T2 中位数要求。** 现有完整候选无法同时补齐逐手中位不增与全帧门槛：0-4 右手回退 forward 会恢复 6 帧超门槛。保持严格要求时，下一步是新增通用同目标求解实验；当前结果明确记为部分通过。
2. **T3 对象抓持。** 零残差前馈已使手部稳定跟踪；500 轮原残差训练仍停在 30 步，物体状态与零残差逐位相同，参考已要求右物体上抬。论文和上游没有提供可唯一补全的去 imitator 控制、预抓握或 RL 动力学配方。下一轮应明确选择单独的控制/接触实验，或先取得作者完整配置与成功轨迹，再继续复现。接触约束 retarget、残差尺度/课程改动均应作为显式新分支，保持本次失败结果可复查。

按简报“T3 有效后”条件，cut/brush 扩展训练尚未启动。完整 rollout 到位后，已准备的 T4 链可继续评分并合成 SVOR 视频。现有证据保留全部失败和缺失覆盖，后续接续从本文件和 `PROGRESS.md` 进入。
