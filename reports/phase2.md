# EgoMatrix RL 第二阶段结果

P1–P3 已完成，全部训练和最终评分已结束。主例与cut均出现真实物体抬起，brush仍未持续持物。三段均完整覆盖原视频，独立GT的整体论文判据均未通过。累计实际训练26163秒，约7.2675 GPU进程小时；评估、渲染和CPU retarget不计入该数。

## P1：接触几何和传感器

接触帧的MANO指尖距物体表面中位约0.7–3.7mm；右中指/小指FK间隙8.71/9.23mm，支持补充接触retarget。原tip传感器与独立PhysX同体同刻读数最大差0N，前30步确无接触。追溯上游发现XHand奖励读末指节link2，移植版读tip，因此本轮加入显式distal对照。

接触参考使主例右拇/中指固定指腹距离中位约+2.3→−2.8mm。零残差实际执行在接触后300ms仍偏离该参考右65.8/左41.8mm；实际q/root重算FK与USD刚体状态一致至约2e−7m。两种驱动均有明显早期偏差，随后由真实训练检验改善。

完整指尖/掌区表、逐帧距离和力曲线见[P1报告](contact-diagnostic.html)、接触区间图（来源：`claude_work/phase2/p1/contact_interval_geometry.png`）、执行几何审计（来源：`claude_work/phase2/p1/EXECUTION_GEOMETRY_AUDIT.md`）。掌心点、腕代理与实体指腹分别定义；非封闭物体网格的符号取最近面法向，距离幅值来自真实三角面。

## P2：通用配置比较

A采用上游量级Kp500/Kd30，effort保持资产0.4/1.1Nm。B采用MANO表面距物体≤5mm激活、目标沿法线内压3mm、权重5、64碰撞采样点/link，保留原关键点和时序项。C启用上游持续指数收紧，有限比较残差/平滑和早期对象课程。原奖励公式及权重、任务质量和摩擦保持。

表中位置误差是两对象对同一重建参考的全程位置均误差平均。完整步数来自关闭提前reset的评估；内部首失败保留原失败项，评估统一额外对象倍率1并关闭训练课程。RSI成功率是随机参考帧初始化的训练成功率，长度和RSI均取末100 epoch。

|配置|改动类别|epoch / env|末100平均长度|RSI成功率|完整步数 / 内部首失败|双侧参考位置均误差 mm|GT最坏平移 m / 旋转 rad|
|---|---|---:|---:|---:|---:|---:|---:|
|A+C，原T2参考|上游驱动/持续课程|600 / 256|12.19|4.26%|497 / 30|87.77|0.1776 / 3.1377，失败|
|A+B+C，tip取力|加通用接触项|600 / 256|12.60|4.25%|497 / 30|107.42|0.2059 / 3.1398，失败|
|A+B+C，distal取力|加上游末指节读体|600 / 256|12.73|4.26%|497 / 29|85.66|0.1760 / 3.1371，失败|
|distal＋课程×2|通用残差/平滑/早期课程|600 / 256|16.78|3.59%|497 / 78|80.72|0.1814 / 3.1405，失败|
|课程×2恢复v1驱动|驱动对照|600 / 256|16.82|3.62%|497 / 30|83.26|0.2003 / 3.1380，失败|
|课程×2采用上游net读取|全碰撞读取范围对照|600 / 256|17.05|3.62%|497 / 31|84.28|0.1866 / 3.1409，失败|
|课程×2最佳长训|同参数接续|1500 / 1024|14.88|6.93%|497 / 32|54.58|0.1405 / 3.1264，失败|
|课程×4短训|通用课程×4/96000|600 / 256|64.87|14.46%|497 / 30|74.81|0.1779 / 3.1412，失败|
|**课程×4最终最佳**|**同参数接续**|**900 / 1024**|**67.87**|**9.26%**|**497 / 30**|**41.74**|**0.1630 / 3.1265，失败**|

课程×2使用残差1、滑动平均0.2、初始额外对象阈值×2/32000控制步；×4仅改为倍率4/96000步。原残差对照为残差2、滑动平均1、额外倍率1。长训前600轮均256环境，之后1024环境精确接续，课程counter19200→28800→38400。

C2在1500轮确有自身改善，因C3的持续抬起与配对误差更优转资源扩展。主例C3从900到1200的配对误差41.74→82.23mm，右参考高抬区实际均值79.40→0.017mm，按300轮平台规则停止，保留best900和latest1200。选型仅使用训练、实际仿真和重建参考；GT在候选冻结后评分，结果未反馈训练选型。

跨配置物理跟随图（来源：`claude_work/phase2/p3/main_reference_comparison.png`）左上显示主例900轮在参考高抬阶段持续离桌，末段仍约65mm高；右上显示左物体基本留桌。下排显示参考位置误差。训练汇总（来源：`claude_work/phase2/p2ac/TRAINING_SUMMARY.md`）、运行注册表（来源：`claude_work/phase2/p2ac/registry.json`）、主例冻结记录（来源：`claude_work/phase2/p2ac/FINAL_BEST_FROZEN.json`）保留完整曲线、checkpoint及停止依据。

## P3：相同参数扩展

主例900轮完整497步、右参考高抬区均值79.40mm、半参考高度占比96.06%，达到本阶段扩展条件。cut与brush沿用全部C3数值、seed0、同接触目标和256/600→1024分段流程，仅任务输入不同。

|任务|best / latest epoch|末100平均长度|RSI成功率|完整步数 / 内部首失败|配对参考位置误差mm|右高抬区平均实际升高mm|达到半参考高度占比|
|---|---:|---:|---:|---:|---:|---:|---:|
|主例|900 / 1200|67.87|9.26%|497 / 30|41.74|79.40|96.06%|
|cut|900 / 1200|95.42|24.59%|399 / 26|31.17|34.68|100.00%|
|brush|900 / 1200|65.93|18.17%|417 / 90|56.25|0.02|0.00%|

主例最大抬起125.01mm；cut最大44.15mm，参考最大47.14mm。cut1200的配对误差31.17→54.82mm、右旋转均误差0.663→2.574rad，故保留900。brush1200的配对误差56.25→63.51mm，长度65.93→65.89，持续抬起仍缺失，亦在该300轮边界停止。两任务的900/1200及更早300/600结果完整保留。

cut399、brush417控制帧的双手参考全部通过0.7指尖门槛与原table校验。brush原1200步table repair仅两帧未收敛；复用native和同Adam状态，分别额外81/110步后达到原50µm容差。统一接续预算开关默认0，本轮三任务采用额外1200上限，已通过的输出复用；未更改接触/桌面权重或容差。见[扩展几何与数值修复报告](retarget-expansion.html)。

## 独立GT与Appendix C

论文判据要求两对象在全部源帧平移<100mm且旋转<1rad。沿用现有T4 scorer，单个固定尺度SE(3)对齐双对象质心，旋转采用各对象首共同帧偏置。覆盖与最大误差如下；每个任务整体均失败。

|任务/手/对象|原RGB覆盖|最大平移mm|最大旋转rad|对象判据|
|---|---:|---:|---:|---|
|主例 lh/024|249/249|35.12|0.40283|通过|
|主例 rh/032|249/249|162.96|3.12650|失败|
|cut lh/049|200/200|24.20|0.08539|通过|
|cut rh/122|200/200|81.53|2.98061|失败|
|brush lh/146|209/209|74.89|0.30103|通过|
|brush rh/071|209/209|150.66|3.13291|失败|

主例右对象平移和旋转均超阈值；cut两对象的平移全程通过，右对象旋转超阈值。其右旋转首次超阈值位于源行4。各任务的详细误差图、覆盖、首失败行及独立评分见三任务评分汇总（来源：`claude_work/phase2/p3/FINAL_THREE_TASK_SCORES.md`）。

Appendix C对象运动均值：ATE为对齐后位置误差，ARE为旋转误差，RTE/RRE为相邻帧相对运动的位置/旋转误差。

|任务/手/对象|ATE mm|ARE rad|RTE mm|RRE rad|
|---|---:|---:|---:|---:|
|主例 lh/024|23.452|0.144867|0.935|0.017908|
|主例 rh/032|83.213|1.934009|6.912|0.108426|
|cut lh/049|7.242|0.037570|0.199|0.002566|
|cut rh/122|30.659|1.204176|4.599|0.097363|
|brush lh/146|33.919|0.126453|1.195|0.019242|
|brush rh/071|67.964|2.266629|5.487|0.044927|

ATE/ARE各使用249、200、209源帧；RTE/RRE各使用248、199、208帧对。逐帧值、RMSE及p95保留在各独立评分JSON；三任务评分复用已冻结状态。

## 视频与实际查看

完整主例SVOR合成视频（来源：`claude_work/phase2/p3/final_main900_video/video/composite.mp4`）为1280×720、30fps、249帧、8.3秒，原时序全帧渲染/合成与实际解码均通过。渲染读取冻结的真实物理状态，帧循环物理积分为0；背景沿用原SVOR，未重复读取GT。

关键阶段对照（来源：`claude_work/phase2/p3/final_main900_video/video/key_stages.jpg`）与四列多帧图（来源：`claude_work/phase2/p3/final_main900_video/video/preview_5frames.jpg`）已实际查看。图中右手机械勺离桌并移到碗上方；后段转向和放下位置偏离原RGB，最终斜置碗内。目视覆盖所列抽样帧，全片完整性由249帧清单及解码回执核验。见视频报告（来源：`claude_work/phase2/p3/final_main900_video/REPORT.md`）。

## 文件与开关

源码根为本地`sources/EgoMatrix/RL/`、远端`source/EgoMatrix/RL/`。新功能由显式开关启用，旧默认保留。

|文件|开关/用途|改动类别|
|---|---|---|
|`egomatrix_rl/utils/physics_profile.py`、`egomatrix_rl/env_config.py`|`xhand_physics_profile=stable_contact_v2`|关节增益取ManipTrans上游；effort按资产；继承v1数值稳定设置|
|`retarget.py`、`egomatrix_rl/retargeting/optimizer.py`|`--contact-weight`、`--contact-source-distance`、`--contact-target-penetration`、`--contact-reference-pkl`|论文未说明的通用接触项，默认权重0|
|`retarget.py`|`--upsample-table-repair-continuation-iterations`|默认0，同目标数值接续|
|`egomatrix_rl/env.py`、`egomatrix_rl/env_config.py`|`tighten_exp_continuous`|ManipTrans上游持续指数课程|
|同上|`residual_multiplier`、`actions_moving_average`、`object_failure_initial_multiplier`、`object_failure_curriculum_steps`|论文未说明的通用残差/平滑/额外课程选择|
|同上|`contact_sensor_body_source=distal`、`contact_force_scope`|末指节读体对照上游；最终采用对象过滤，net分支为IsaacLab全碰撞净法向力、摩擦通道0|
|同上|`evaluation_full_sequence=True`|本阶段授权的完整评估，内部失败单独保存|
|`egomatrix_rl/utils/runtime_config.py`、`egomatrix_rl/utils/rollout_trace.py`|checkpoint配置继承、实际开关及control-post失败字段|运行兼容与来源记录|

编译、旧默认与分支检查见switch_verification.json（来源：`claude_work/phase2/p2ac/switch_verification.json`）。补丁：控制（来源：`claude_work/phase2/p2ac/source_snapshot/phase2_changes.patch`）、接触（来源：`claude_work/phase2/p2b/changes.patch`）、数值接续（来源：`claude_work/phase2/p2b/extension_numerical_changes.patch`）。控制分支与零残差参考审计保留在P1/P2报告；曾出现trace首行字段schema失败，已修复并保存失败日志。

## 遗留与下一步

当前已证实通用配置能在主例和cut中带动物体；完整论文转移成功仍为0/3，brush抓持未形成，主例与cut右对象旋转及末段放置仍需改善。下一阶段优先核查右对象初始姿态/落桌动力学、重建参考与GT的旋转坐标契约，再在单独标记的分支设计控制消融。固定这轮测试结果与配置，继续采用独立证据评价后续改动。

远端工作根：`claude_work/phase2/`。完整权重、训练日志和逐帧渲染保留远端；报告、曲线、实际参考、最终评估轨迹、独立评分、MP4和多帧图已同步本地。恢复入口为阶段状态（来源：`claude_work/phase2/status.md`）、PROGRESS.md（来源：`claude_work/PROGRESS.md`）及各最终冻结JSON。
