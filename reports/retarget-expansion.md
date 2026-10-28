# P3 cut / brush 接触 retarget 扩展

主例触发 P3 后，两任务四手使用相同接触配置和求解预算生成独立参考。原主例 `REPORT.md`、审计和曲线保留。CPU运行与真实RL loader导出均已完成；独立GT未在本阶段读取。

通用参数：MANO指尖表面距物体 ≤5 mm激活，末指节指腹目标内压3 mm，接触损失权重5；每帧300次，首帧3000次，table repair1200次，使用各自T2选定native reverse种子。

| 任务 | 手 | 实际参考帧数 | 0.7门槛失败帧 | 原训练门槛最大比 | T2→B指尖误差中位mm |
|---|---|---:|---:|---:|---:|
| TACO_task0-1 | lh | 399 | 0 | 0.270 | 0.661→3.508 |
| TACO_task0-1 | rh | 399 | 0 | 0.448 | 6.713→7.104 |
| TACO_task0-2 | lh | 417 | 0 | 0.536 | 4.782→7.066 |
| TACO_task0-2 | rh | 417 | 0 | 0.473 | 5.185→6.072 |

负表面距离表示指腹进入物体内侧；几何表和曲线采用MANO真实近表面帧中的固定指腹对应点。

| 任务 | 手 | 指 | 激活native帧 | T2→B指腹有符号距离中位mm |
|---|---|---|---:|---:|
| TACO_task0-1 | rh | thumb | 95 | 2.483→-2.976 |
| TACO_task0-1 | rh | index | 34 | 0.559→-0.474 |
| TACO_task0-1 | rh | ring | 2 | 2.957→-0.354 |
| TACO_task0-1 | rh | pinky | 1 | -1.377→-3.000 |
| TACO_task0-1 | lh | thumb | 4 | 0.571→-1.085 |
| TACO_task0-1 | lh | index | 78 | 3.232→-2.998 |
| TACO_task0-1 | lh | middle | 181 | 4.396→-0.568 |
| TACO_task0-1 | lh | ring | 180 | 0.702→-3.001 |
| TACO_task0-1 | lh | pinky | 49 | 0.384→-1.548 |
| TACO_task0-2 | rh | thumb | 120 | 0.777→0.350 |
| TACO_task0-2 | rh | index | 98 | 0.308→0.084 |
| TACO_task0-2 | rh | middle | 38 | 0.440→0.140 |
| TACO_task0-2 | rh | ring | 17 | 3.041→0.705 |
| TACO_task0-2 | rh | pinky | 3 | 5.552→7.474 |
| TACO_task0-2 | lh | thumb | 96 | 3.478→-0.153 |
| TACO_task0-2 | lh | index | 103 | 7.520→0.266 |
| TACO_task0-2 | lh | middle | 13 | -0.505→0.725 |
| TACO_task0-2 | lh | ring | 2 | 2.812→6.788 |

配置比对：`all_tasks_contact_config_comparison.json`；三个任务六手的optimizer_config完全一致。

交付：`retarget_contact_v1/`、`actual_reference_contact_v1/`、`task_audits/<task>/audit_contact.json`、`cut_contact_surface_audit.json`、`brush_contact_surface_audit.json`、`cut_contact_surface_curves.png`、`brush_contact_surface_curves.png`。

合并入口：`all_tasks_actual_reference_audit.json`、`all_tasks_contact_surface_audit.json`。物理和PPO效果由同C3配置的训练评估阶段验收。

## 同目标数值接续与原失败

brush LH 原1200步 table repair 失败日志保留在 `logs/TACO_task0-2_lh.log`：帧289、290仍未满足1 mm clearance，最大违反0.88528 mm。原T2 brush LH 使用相同clearance、64点/link、50 µm容差与1200预算，最终最大46.67 µm通过。

本次复用已完成native结果，将各输出帧独立的原table repair分到8CPU；原1200后仍无可行姿态时，保留同一Adam状态、同一preservation参考和权重继续。帧289、290分别只额外81、110步即找到可行姿态，未用硬投影。全417帧最终table clearance违反最大49.6507 µm，全部低于原50 µm容差。

新增 `retarget.py --upsample-table-repair-continuation-iterations`，默认0；本轮统一启用最多1200额外步，仅原预算无可行姿态时触发。main、cut及brush RH原已通过的导出直接复用。三任务相同导出规则与实际触发记录见 `all_tasks_export_policy.json` 和各 `task_audits/<task>/export_manifest.json`。接触配置与原300/3000预算完全不变；原table初始预算仍为1200。

| brush LH实际60Hz帧 | 额外Adam步 | 最终clearance违反µm | 五指中最大MANO误差mm | 激活食指指腹到物体表面mm | 食指到名义接触目标mm |
|---|---:|---:|---:|---:|---:|
| 289 | 81 | 18.179 | 40.293 | +3.335 | 6.899 |
| 290 | 110 | 48.995 | 41.143 | +2.716 | 5.992 |

这里食指表面距离正值表示仍在物体外侧；table修复后的两帧仍保留这项接触残差。奇数60Hz帧采用相邻native局部接触点与目标线性插值、任邻激活，偶数帧精确对应native，定义与数值见 `brush_continuation_affected_frames.json`。

cut与brush的曲线已实际查看。cut左中/无名指的多数接触帧由物体外侧移向内压目标；brush左拇/食指的大多数原外距明显下降，部分时刻仍存在数毫米残差。固定3 mm法线位移在薄、非封闭物体网格上对应的实际有符号最近距离可接近0或略为正，原始几何统计完整保留，所有任务继续使用同一目标构造。

源码最小增量：`extension_numerical_changes.patch`；初始B源码patch与主例 `REPORT.md` 保留。本阶段CPU任务均已结束，cut/brush actual参考已同步本地并交训练owner接续同C3训练。
