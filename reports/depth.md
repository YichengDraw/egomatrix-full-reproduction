# Box 相对深度 C/D：完整评价

新增深度项使 D 的平均位置误差比继续优化对照 C 低 1.22 mm，z 方向运动幅度缩小 10.04 mm；**z 速度误差略升，留出深度 pair 的完整支持率从 96.75% 降到 81.82%**。按预先设定的 z 动态推进条件，当前结果应先反馈并诊断深度时序与支持丢失，再决定后续 A2。

## 执行与固定条件

- C、D 均从最终 ObsRefine 初始化，各 300 步，退出码 0，耗时 160.21 / 164.10 s。两条终态确认后才读取预测并评分。
- 两组只差新增深度损失权重：C 为 0/0，D 为 gap 0.20、ordering 0.05。预测生成不读取 GT。
- 74 个原始帧、30 Hz、手、K、mesh、尺度和有效身份保持一致。C/D rotation 数组与 ObsRefine 逐值相同；全部非 object 字段逐字节相同。
- GT 仅用于统一评价；沿用既有 Raw 冻结 canonical offset。旋转分数与 ObsRefine 完全相同，ARE=0.74048 rad、RRE=0.05538 rad、camera angular velocity vector error=1.91040 rad/s。
- 两组都未触及 100 mm 修正上限。

## 主结果

| 指标 | ObsRefine | C：继续优化 | D：新增深度 |
|---|---:|---:|---:|
| centroid position error (mm) | 66.27 | 65.56 | 64.34 |
| centroid velocity vector error mean (mm/s) | 241.78 | 236.79 | 237.78 |
| z velocity absolute error mean (mm/s) | 212.47 | 207.66 | 209.36 |
| centroid velocity vector error P95 (mm/s) | 684.70 | 679.77 | 667.01 |
| object z P95−P5 range (mm), GT=72.06 | 237.05 | 237.66 | 227.62 |
| object mean speed / GT | 2.673 | 2.620 | 2.656 |
| hand-object relative joint position error (mm) | 70.77 | 70.01 | 66.92 |
| hand-object relative joint velocity error (mm/s) | 321.03 | 321.64 | 309.24 |
| original-resolution mask IoU | 0.64917 | 0.65100 | 0.64541 |
| holdout RGB displacement EPE, pair-equal (px) | 2.507 | 2.498 | 2.486 |

D 相对 C：平均位置误差下降 1.86%，相对 joint position/velocity error 下降 4.42% / 3.86%；z 速度误差上升 0.82%，整体平均 velocity error 上升 0.42%。z 幅度仍为 GT 的约 3.16 倍。

RGB 观测保持在本轮已设容差内：IoU 下降 0.00559（容差 0.02），留出 EPE 改善约 0.0123 px（允许增加 0.5 px）。这里 IoU 是训练拟合检查，RGB 留出轨迹是额外观测检查。

## 速度尾部：P95 与最坏帧分别报告

本表的 P95 是 \(\mathrm{P95}(\|v_{\mathrm{pred}}-v_{\mathrm{GT}}\|_2)\)，使用真实相邻时间差；它与预测速度本身的 P95 分开保存。

| 最高误差 source pair | midpoint (s) | ObsRefine (mm/s) | C (mm/s) | D (mm/s) |
|---|---:|---:|---:|---:|
| 43 → 44 | 1.4500 | 871.04 | 878.58 | 1095.05 |
| 44 → 45 | 1.4833 | 863.06 | 877.11 | 986.56 |
| 42 → 43 | 1.4167 | 775.88 | 779.56 | 963.87 |

D 的误差 P95 比 C 低 1.88%，但同一 43→44 pair 的最大误差高 24.64%。运动图第二排的线速度和最后一排的相对速度均能看到约 1.4–1.5 s 的额外尖峰。完整 top10 见 `velocity_error_tails.json`。

## 独立 CPU 真实 mesh depth-gap 验收

冻结输入共有 814 对 patch，覆盖 53/74 帧；训练 660、留出 154。固定序列 MoGe 尺度为 1.049088070840933。各条件使用同一像素、手表面深度、pair 和划分。

CPU 验收对真实三角 mesh 建 BVH，按原 K 发出整数 RGB 像素中心射线，取最近正光轴深度。此路径与训练时的可微 hard zbuffer 分开；使用现有 CPU Embree。NPZ 的冻结 pixel set 中任一像素失去交点，整 pair 记缺失并罚 20；pair 原分母保留。median 在偶数像素数时取中间两值均值。

初始化独立检查：814/814 pair 全像素支持。重算手深度的平均绝对差 \(1.79\times10^{-5}\) mm；物体初始化 front 与冻结值 RMSE 为 \(2.96\times10^{-5}\) mm。它支持当前整数像素与 optical-Z 契约一致。CPU 完整初始化验收耗时 0.271 s。

| 留出 depth 指标 | ObsRefine | C | D |
|---|---:|---:|---:|
| 固定 pair 分母 | 154 | 154 | 154 |
| 全部 frozen pixels 仍有交点的 pair | 154 | 149 | 126 |
| 完整 pair coverage | 100% | 96.75% | 81.82% |
| 平均 pixel hit fraction | 100% | 99.83% | 96.25% |
| 条件 gap 绝对残差，pair mean (mm) | 35.99 | 36.72 | 30.63 |
| 条件 gap 绝对残差，frame-equal mean (mm) | 36.71 | 37.47 | 30.21 |
| 主 gap Huber，missing=20，frame-equal | 3.1902 | 3.8025 | 6.2090 |
| ordering Huber，missing=20，frame-equal | 0.5548 | 1.0866 | 4.0627 |

D 在有完整支持的 pair 上残差较低，支持覆盖同时减少。原始 154 pair 分母下的 gap/ordering 主分数都上升。图中 0.7–1.5 s 的 D coverage 多处降低，有 5 个留出 frame 没有任何满足完整 pixel 要求的 pair；相应条件残差曲线保留缺口。

附加的共同支持诊断固定取三组都支持的 123 个留出 pair、48 帧，frame-equal gap 残差为 ObsRefine 34.57、C 34.69、D 30.41 mm。它说明 D 拟合了一部分新增深度观测；主评价仍保留全部 154 pair 的 missing20 分数。

## 结论范围与下一步依据

这一轮同时观察到：D 的位置与相对几何小幅改善、RGB 保真保持，z 速度和全分母深度损失未改善，最坏速度错误变大。当前证据适合优先检查 MoGe 相对深度的时序变化、固定手深度误差，以及 frozen-pixel 支持丢失的来源，再决定联合位置或尺度/姿态分支。实验范围为这一条开发 box 视频。

## 文件

- `all_metrics.csv`、`dexycb_box.json/.md`：Obs/C/D 的完整 XYZ、幅度、速度、角速度、相对及 RGB 数值。
- `velocity_error_tails.json`：速度向量误差 P95、预测速度 P95 和 top10 原始 source pairs。
- `identity_checks.json`：终态、rotation 与全部非 object 字段的固定条件检查。
- `motion_comparison.png/.pdf`、`motion_curves.csv`：Obs/C/D/GT 同步曲线，已实际打开检查。
- `depth_gap_metrics.json`、`depth_gap_per_pair.csv`：独立 CPU 真 mesh 留出验收；`depth_gap_curves.png/.pdf` 已实际打开检查。
- `depth_gap_common_support_diagnostic.json`：三组共同支持的单独诊断。
- `initialization_cpu_embree/`：初始化独立射线验收记录。

慢速 Rtree CPU 初始检查在现有 Embree 完整验收成功后停止；没有动用 GPU，也没有修改 patch、旧项目或模型。C/D 和所有评分产物均保留于本地与 L40S 新任务目录。
