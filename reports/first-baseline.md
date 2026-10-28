# 首轮完整 baseline：2026-10-24

完整重建与三个一次更新API已齐。三个有可靠官方标注对应的样本分别完成249、200、209个原帧的A1→Scene→A2→最终候选阶段；260帧原刷洗样本完成全片视觉与预测物理评价。论文忠实性、视觉质量和完整policy任务成功仍待解决。

## 完整重建：动态、穿透与物理结果

腕物相对速度误差指物体中心相对手腕的速度误差。Dpen为预先绑定手—物对的逐帧最大手顶点穿透深度均值；SD为固定手条件下物体自由物理仿真的位移。三项均越小越好。

| 完整原序列 | 帧/相邻对 | 腕物相对速度误差 A1→最终候选 mm/s | Dpen A1→A2→最终候选 mm | SD A1→最终候选 mm |
|---|---:|---:|---:|---:|
| TACO bowl/ladle，20231105_019 | 249/248 | 360.878→242.448 | 0.699→0.306→1.184 | 96.780→83.515 |
| TACO cut，20230926_037 | 200/199 | 295.811→212.841 | 4.426→0.220→1.362 | 82.838→71.471 |
| TACO brush，20230927_027 | 209/208 | 393.941→199.590 | 1.551→0.470→1.062 | 83.299→63.817 |
| 原brush，20230919_036，仅视觉/物理 | 260帧 | N/A | 0.662→0.826→1.329 | 91.745→55.439 |

三个可GT评分样本的腕物相对运动误差均低于A1，四个样本的A2→最终候选Dpen均增加。原260 RGB与262行标注缺可靠逐帧映射，保持完整输入和视觉/物理范围。多手SD与allhands Dpen作为补充列，主列沿预先绑定手—物对；作者scorer的手集合解释仍待确认。

只有cut实际启用了额外全帧touch-table support：切板平均移动16.148mm、平均旋转2.792°，并刚体带动左手，物体轨迹收益归此预处理。该阶段标为“Grounding＋A3（候选实现）”。其余三段support未启用，四段object-collision prepass均未启用，物体轨迹保持保存精度内不变。论文A.1 grounding限定非接触物体且手不变，A.3固定物体轨迹；本轮候选链据实际配置分段披露。

## 原核安全审计

全部端点与相邻边保存原核双向几何；原规则仅判定task-only与接触边界子集。contact-contact原判定N/A单列。signed为原核双向最小有符号距离，负值表示穿透；原接触包络可有负接受下限。

| 样本 | 全部端点/侧边 | 原适用边 | 其中失败 | N/A边 | 原适用集合最深bound signed/limit mm | 全片最深bound signed mm |
|---|---:|---:|---:|---:|---:|---:|
| bowl/ladle249 | 498/496 | 164 | 1 | 332 | −7.067/−6.865，fail | −8.729，N/A |
| cut200 | 400/398 | 11 | 10 | 387 | −7.867/−7.045，fail | −10.140，N/A |
| brush209 | 418/416 | 170 | 0 | 246 | −7.286/−7.532，pass | −9.283，N/A |
| 原brush260 | 520/518 | 60 | 4 | 458 | −6.034/−6.352，pass | −18.158，N/A |

brush209最深原适用非绑定物体signed为+90.418mm/limit0，全片非绑定最小为+29.456mm/N/A；最深端点双向signed−8.831mm、端点判定N/A。old260四条失败为LH23与RH21/27/234，各signed/limit及最深端点−14.660mm/N/A见专页。cut的10条失败含1条绑定刀穿透失败和10条非绑定切板障碍失败；主249的唯一失败为RH11→12。上述原适用通过率与完整几何穿透分别记录。

## 实际参考与一次更新API

实际loader参考分别完整保留497、399、417个60Hz帧，精确even映射原249、200、209时刻；消费参考的物体轨迹/表面物理评分已齐。smoothed778缺native MANO FK，RA、CD_h与官方腕物相对速度为N/A。

| 独立API任务 | 一次更新episode | 实际参考覆盖 | 原帧/独立GT覆盖 | 终态 |
|---|---:|---:|---:|---|
| bowl/ladle task0-0 | 9控制步/0.15s | 9/497 | 5/249 | 拇指、食指、中指、小指失败 |
| cut task0-1 | 9控制步/0.15s | 9/399 | 5/200 | 拇指、食指、中指失败 |
| brush task0-2 | 9控制步/0.15s | 9/417 | 5/209 | 拇指、食指、中指失败 |

每个API均8环境、seed0、1个PPO epoch，完整retarget预算沿冻结配置执行。actual consumed tracking、retarget FK→MANO固有差异、仿真→FK执行差异和独立GT任务transfer分别留档。三个短episode的完整任务判定均失败。主formal按原1024环境、最大10000 epoch配置继续，下一固定验收为原生epoch2000/10月25日03:00节点，沿22:42阶段记录与既有事件接续。

## 结果入口与后续问题

- 249帧候选A3与原核审计（来源：`results/APPENDIX_C_A3_SUMMARY.md`）、实际参考与主API（来源：`results/APPENDIX_C_A3_SMOOTHED_AND_API_SUMMARY.md`）
- cut候选阶段及额外grounding归因（来源：`results/APPENDIX_C_ELIGIBLE_CUT_A3_SUMMARY.md`）、cut消费参考与API（来源：`results/APPENDIX_C_ELIGIBLE_CUT_CONSUMED_AND_API_SUMMARY.md`）
- brush209完整阶段与审计（来源：`results/APPENDIX_C_BRUSH209_A3_SUMMARY.md`）、brush消费参考与API（来源：`results/APPENDIX_C_BRUSH209_CONSUMED_AND_API_SUMMARY.md`）
- 原brush260视觉/物理范围与审计（来源：`results/APPENDIX_C_BRUSH260_A3_SUMMARY.md`）

绝对姿态与外观差距仍明显：主249物体旋转误差ARE为1.410rad，末段勺方向偏差已在f186/248实际查看；cut的刀/手腕，以及两段brush的指形和刷体轮廓仍有可见偏差。已有同帧五帧图分别见主249（来源：`results/frontdepth_overlay/official_taco_development/A1_Scene_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）、cut200（来源：`results/frontdepth_overlay/paper_taco_cut_eligible_validation/A1_Scene_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）、brush209（来源：`results/frontdepth_overlay/paper_taco_brush_eligible_development/A1_Scene_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）、原brush260（来源：`results/frontdepth_overlay/paper_taco_brush_development/A1_Scene_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）。这些视觉证据与相对运动指标共同决定后续改进方向。

后续重点是论文允许的处理边界、完整视频中的手物对齐/穿透，以及足额策略对完整任务的执行。小样本完整baseline提供逐段证据，论文aggregate实验与作者展示的视觉、动态效果仍是待达到的目标。本页汇总已冻结结果，沿既定节点推进主formal；当前没有新增修复实验或候选优化。
