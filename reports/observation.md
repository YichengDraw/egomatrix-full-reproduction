# 物体观测修正：两条正式结果

在这两条已接触开发样例上，RGB 观测修正进一步降低了 LP5 后的平均位置、速度和旋转动态误差，并改善了留出的 RGB 位移检查。深度方向的运动幅度仍偏大，速度 P95 也高于 LP5。下一步的主要问题是深度轨迹和较大朝向跳变。

## 执行与固定评价

- box / banana 的正式 receipt 均为 `exit_code=0, steps=300`，耗时 42.34 / 40.25 s；只在终态确认后评分。
- Raw / LP5 / ObsRefine 使用相同完整 74 / 72 源帧、相同时间戳、未滤 GT 和各序列 Raw 冻结的 canonical 右 offset。固定资产为新根 `fixed_eval_contract/{tag}.json`。
- LP5 使用最终固定 10 次 SO(3) 均值迭代，整个正式优化期间初始化文件保持冻结。
- ObsRefine 除 `object_T`、`object_centroid_m` 外的全部原数组与 Raw 字节相同，手、K、mesh、尺度、帧和 valid 身份均保持一致。检查记录在 `runs/obs_refine/{tag}/evaluation_identity.json`。
- 相对指标是共同 camera 轴中的 hand joint−各自 object surface centroid，GT 可直接比较。本文没有将其称为接触滑动。

## box

| mean 指标 | Raw | LP5 | ObsRefine |
|---|---:|---:|---:|
| centroid position error (mm) | 73.68 | 70.71 | 66.27 |
| centroid velocity error (mm/s) | 582.09 | 275.61 | 241.78 |
| centroid RTE (mm) | 19.40 | 9.19 | 8.06 |
| ARE (rad), shared Raw offset | 0.7623 | 0.7505 | 0.7405 |
| RRE (rad), shared Raw offset | 0.1612 | 0.0657 | 0.0554 |
| camera angular velocity vector error (rad/s) | 4.978 | 2.239 | 1.910 |
| hand-object relative joint position error (mm) | 77.54 | 75.56 | 70.77 |
| hand-object relative joint velocity error (mm/s) | 548.33 | 324.80 | 321.03 |
| original-resolution mask IoU | 0.63338 | 0.63605 | 0.64917 |
| holdout RGB displacement EPE, pair-equal (px) | 6.763 | 3.154 | 2.507 |

对 LP5，ObsRefine 的 centroid velocity error 下降 12.28%，留出 RGB EPE 下降 20.50%；相对 joint velocity error 仅下降 1.16%。

## banana

| mean 指标 | Raw | LP5 | ObsRefine |
|---|---:|---:|---:|
| centroid position error (mm) | 93.37 | 92.35 | 88.79 |
| centroid velocity error (mm/s) | 572.33 | 196.67 | 132.89 |
| centroid RTE (mm) | 19.08 | 6.56 | 4.43 |
| ARE (rad), shared Raw offset | 0.9986 | 1.0018 | 0.9481 |
| RRE (rad), shared Raw offset | 0.1555 | 0.1469 | 0.1086 |
| camera angular velocity vector error (rad/s) | 4.373 | 4.113 | 2.958 |
| hand-object relative joint position error (mm) | 90.40 | 89.51 | 85.98 |
| hand-object relative joint velocity error (mm/s) | 539.58 | 241.69 | 202.39 |
| original-resolution mask IoU | 0.60619 | 0.60773 | 0.66531 |
| holdout RGB displacement EPE, pair-equal (px) | 6.321 | 2.661 | 1.931 |

对 LP5，ObsRefine 的 centroid velocity error 下降 32.43%，angular velocity vector error 下降 28.08%，相对 joint velocity error 下降 16.26%，留出 RGB EPE 下降 27.46%。

## 动作幅度与残留问题

| ObsRefine / GT 量 | box | banana |
|---|---:|---:|
| camera x velocity absolute error (mm/s) | 42.16 | 30.88 |
| camera y velocity absolute error (mm/s) | 65.13 | 58.45 |
| camera z velocity absolute error (mm/s) | 212.47 | 95.34 |
| object x P95−P5 range (mm), Obs / GT | 34.30 / 15.81 | 61.15 / 31.97 |
| object y P95−P5 range (mm), Obs / GT | 206.29 / 181.86 | 275.00 / 220.81 |
| object z P95−P5 range (mm), Obs / GT | 237.05 / 72.06 | 128.25 / 32.07 |
| object mean speed / GT | 2.67 | 1.84 |
| object speed P95 (mm/s), LP5 / Obs / GT | 836.02 / 1019.79 / 463.33 | 937.10 / 947.86 / 663.99 |

这些量说明平均误差下降后仍保留较大的深度额外运动。box 深度幅度约 GT 的 3.3 倍，banana 约 4.0 倍。速度 P95 高于 LP5，不能用平均速度误差下降代替整个速度分布的改善。

三组运动曲线和独立观测曲线均已实际打开检查：

- box 的 ObsRefine 降低了一些深度和角速度尖峰，但保留约 1.4 s 的额外深度抬升，以及与 GT 不同的最终转角。相对速度曲线多数时段接近 LP5，符合仅 1.16% 的平均相对速度改善。
- banana 的 1.1 s 朝向跳变仍清楚可见，ObsRefine 降低了它的角速度峰值。depth range 和较慢的位置偏差仍在。
- 观测图中，banana 的 mask IoU 改善覆盖多个时段；两段留出 RGB 位移误差曲线多数尖峰降低，部分 pair 仍变差。

## 观测检查范围

每个条件共用同一冻结 LP5 射线关联的 `q_local_m`，没有为 Raw 或 ObsRefine 重建表面对应。EPE 先在每个 source pair 内平均点误差，再跨 pair 等权平均。box 留出支持为 850 点 / 73 pairs；banana 为 321 点 / 69 pairs。三组支持一致。

SAM3 object mask 已参与优化，其 IoU 是拟合检查。留出 RGB tracks 提供额外的观测检查；轨迹来自同一短视频。GT 仅用于固定评价，不进入低通或 ObsRefine。结果范围是这两条开发样例。

## 文件

- `all_metrics.csv`：三组完整表，包括 x/y/z 速度误差、各轴 P95−P5、速度 P95、角速度分量、相对指标与观测覆盖率。
- `{tag}.json`、`{tag}.md`：每段完整精确数值表。
- `{tag}/motion_comparison.png`、`.pdf`、`motion_curves.csv`：Raw / LP5 / ObsRefine / 原始 GT 的十二项同步曲线。
- `observation_curves.png`、`.pdf`：原分辨率 mask IoU 与留出 RGB pair EPE 曲线。
- 新根 `results/paired_dynamic/{tag}/full_source_common/`：同 Raw offset 的完整机器可读分数。
- 新根 `results/observation_comparison/{tag}/`：CPU 原分辨率观测检查与逐帧 mask 分数。

输入、终态 receipt、预测与评分资产都保留在项目目录和研究服务器同名目录；旧项目只读。没有因这些结果进行 GT 调参或额外模型训练。
