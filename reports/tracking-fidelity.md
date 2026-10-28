# Phase 4：A1 论文与 FoundationPose tracking 对齐审查

核查日期：2026-10-26。范围：只读本地论文、adapter、远端实际源码、冻结配置与已有运行回执；未启动 GPU，未修改 adapter。远端连接使用 `研究服务器连接`，核验用户为 `研究账号`。

## 结论

当前 A1 已实现论文明确描述的两类后续帧假设：相机运动传播与 SpatialTracker 刚体运动，经 FoundationPose 细化后同组评分。注册 5 次、跟踪 2 次与官方 `run_demo.py` 默认完全一致。当前证据没有发现相机运动重复应用或候选 valid 掩码误丢失。

主要未公开细节是遮挡阈值与证据定义。当前采用 `.5` 遮挡比例、`.5` 投影可见覆盖比例及 32 个有效深度像素；论文没有给这些数值。`visibility_evidence_json` 参数仅被记录，adapter 主体不读取它；严重遮挡只根据相机传播姿态的渲染投影判断。这个条件会受此前姿态漂移影响，需结合 R1 逐帧证据判断是否存在持续锁定。

新增上一帧相机空间姿态作为第三类候选，可以作为“官方 FoundationPose tracking 启发的通用解释”做显式开关。论文文本本身只列两类假设，因此该候选应在最终报告列为解释下的额外候选，收益由实际重跑决定。

## 已核对的来源

- `sources/paper.txt` 约 1099–1112 行：用 scaled mesh、aligned depth、camera trajectory 初始化对象姿态，并以 SpatialTracker 刚体假设增强遮挡传播。
- 同文件约 5133–5153 行：首次有效帧初始化；后续帧组合 camera-motion propagation 和 SpatialTracker rigid hypotheses，FP refine/score 选择；严重手部遮挡时，有足够图像证据则只细化平移，否则保留传播姿态。
- 本地 `code/foundationpose_bootstrap_adapter.py`。
- 远端 `source/EgoMatrix/reconstruction/third-party/FoundationPose/run_demo.py`、`estimater.py`、`learning/training/predict_pose_refine.py`、`predict_score.py`。
- 远端 `source/EgoMatrix/reconstruction/scripts/estimate_motion_candidates.py`、`tracker_motion_candidates.py`、`run_spatracker_v1_adapter.py`。

上述具体文件内容均已直接读取；本轮没有依赖网络摘要。

## 逐项对照

|项目|论文/官方行为|当前实现|结论|
|---|---|---|---|
|首帧注册|首次有效帧；官方 register iteration=5|有效 mask/depth 像素至少 32 后 register 5 次|次数一致；32 属通用实现选择|
|相机传播|论文要求 camera-motion hypothesis|`inv(c2w[t]) @ c2w[t-1] @ previous`|坐标组成正确|
|SpatialTracker|论文要求基于点轨迹刚体拟合|点是逐帧 camera XYZ；直接拟合 t→t+1 并左乘 previous|已包含相机变化，不能再叠加 camera delta|
|普通帧细化|论文多假设 refine；官方 demo track=2|外层两次 `predict(iteration=1)`|同为两次递推，未发现少算或多算|
|官方原生 track_one|直接以前一帧 camera pose 单候选 refine；不调用 scorer|当前只有相机传播和 tracker 候选|增加 previous-camera 可列额外解释开关|
|严重遮挡|有证据只改平移；证据不足保留传播|先只保留 camera 候选，每次 refine 后恢复输入旋转；不足 32 像素则传播|行为方向一致，数值与证据规则未公开|
|候选评分|论文 refine/score；官方 score 是完整组比较|同组一次 `scorer.predict`，取最大值|保持完整组比较正确|
|独立图像可见性证据|论文没有给具体接口|CLI 记录 JSON 路径，主体不读取|实际行为须按 render gate 描述|

### 关于一次两步与两次一步

官方 `PoseRefinePredictor.predict` 在每个内部迭代中，以当前 `B_in_cams` 重新渲染 crop，预测平移和旋转，再更新当前姿态。普通帧当前外层两次调用 `iteration=1` 也执行这条递推。改为一次 `iteration=2` 能使调用与官方入口一致，并减少重复准备；它本身尚不能解释大角度漂移。严重遮挡仍需要逐步恢复旋转，否则普通官方 refiner 会在第二次迭代使用已旋转的姿态。

### 新增上一帧相机姿态的评分披露

官方 scorer 执行 `model(A, B, L=len(A))`，整组候选共同决定分数。因此新增候选会改变同组原候选的 score。全部候选必须同组评分；绝对 score 只用于同帧同组排名，不能跨 variant 当成统一置信度比较。候选集合和每帧选中来源应进入 trace。上一帧姿态与相机传播姿态相同或非常接近时，重复候选也可能改变联合评分；若不去重，应明确记录这个选择，保持所有样本同一规则。

## SpatialTracker valid 与可见性

六个冻结对象均走历史全序列刚体拟合，`motion_candidate_report.json` 不存在，所有候选 valid 全为 True：

|任务|每对象边数|每边候选数|每对象 valid 数|
|---|---:|---:|---:|
|主例|248|5|1240|
|cut|199|5|995|
|brush|208|5|1040|

所以 valid 误丢候选没有影响本批六对象。全局拟合通过首帧 mask、每点最大帧间运动 0.10 m、全序列到质心距离标准差 0.02 m 筛点，随后 5 个刚体拟合均标 valid；它不逐帧消费 tracker visibility。这里的 valid 表示历史筛选后产生的候选存在，未表示某帧对象完整可见或拟合准确。

另外查到未在本批触发的接口缺口：`tracker_motion_candidates.recover_from_tracks` 只查 `tracking_visibility.npz` 或 `spatracker_v2_diagnostics.npz`；V1 实际输出 `<tag>_visibility.npy` 与 `<tag>_tracks.npz`。以后走 local fallback 时应接入 V1 visibility。该缺口与当前全 valid 分支的漂移不能直接关联，本轮不应为它重跑 V1。

## 显式通用候选建议

建议按协调者提出的 `--tracking-variant upstream-augmented` 冻结：普通帧保留原两类假设，加 `previous` 原相机坐标候选，完整组调用 `predict(iteration=2)` 后一起 score；严重遮挡与证据不足两分支沿用当前规则；参数统一保持 5/2、.5/.5、32。原 baseline 默认保留。

这个分支能验证“原生 previous-camera 起点是否更稳”，因果范围明确。它不会直接改变严重遮挡的锁转行为；如果 R1 显示误差主要增长在这一分支，最终应按证据说明该候选作用有限。避免把旋转惩罚、时域平滑、按 GT 选候选等额外规则混进来。

## 远端冻结重跑链与隔离办法

根目录 `R=项目根目录`。完整输入任务 tag：

- 主例：`official_taco_development`，249 帧。
- cut：`paper_taco_cut_eligible_validation`，200 帧。
- brush：`paper_taco_brush_eligible_development`，209 帧。

环境：A1/Scene 用 `$R/envs/foundationpose/bin/python`；CPU配置/export用 `$R/envs/geometry/bin/python`；RL/PhysX 用 `$R/runtime/envs/isaaclab/bin/python`。V1 候选已经完整，可复用 `$R/source/EgoMatrix/reconstruction/Data/<tag>_object<slot>/processed_data/vis_results`。

### 已有脚本

1. `$R/code/prepare_aligned_teacher_workspace.py --root "$R" --candidate <新名>`：CPU 建新候选目录，复制可写小资产、共享 RGB/mask/depth/原始 SAM3D/environment。它保留原始 A1 poses；R2 新输出应安装到该新目录的 `pose_tracking/foundation_pose/ob_in_cam`。脚本没有复制 `vis_results`，需要额外只读链接原完整候选。
2. `$R/candidates/aligned_teacher_v1/code/run_aligned_teacher_stage.py`：独立 `--stage scene|a2|a3 --gpus ...`，提供 `--print-command`。Scene 直接继承冻结 `run_inputs.json` 中的全部学习率、权重、batch/tile及240次预算；A2 native从world-up继续；A3为paper-fixed-objects和1000步。
3. 同目录 `schedule_aligned_teacher_pipeline.py`：已有 pidfd 事件调度，会按完整阶段终态自动衔接 Scene→A2→A3。
4. `$R/code/run_isolated_reconstruction_stage_evaluation.py`：从候选 namespace 导出 Scene/A2/A3、保留原时钟和相机数组，随后独立评分。
5. `$R/code/run_isolated_candidate_api_on_export.py`：EXPORT_READY事件到prepare/300步retarget/API闭环；正式 Phase2 C3 训练及 T2 双向 retarget 需沿 Phase2 脚本接续，这个 listener 本身只跑 8 env/1 epoch API。

### 新候选 namespace 需要的最小准备

`prepare_aligned_teacher_workspace.py` 会复制 paper-aligned Scene 补丁，所以应从它准备新 namespace。把 `aligned_teacher_v1/code/run_aligned_teacher_stage.py` 和相关现有 helper 复制到新 namespace；其中所有写入候选 ID、A3文件名与 handoff 路径的 `aligned_teacher_v1` 统一改为新名。复用 native阶段和冻结参数。

特别核查 `source/EgoMatrix/reconstruction/config/local.env`：当前 `EGOMATRIX_FP_BOOTSTRAP_ADAPTER` 绝对指向 `$R/code/foundationpose_bootstrap_adapter.py`，且 `runtime.sh` 每次 source 会覆盖环境值。若要隔离 adapter，须将新 namespace 自己的 local.env 中这一行改为新副本。环境/权重缓存仍可指向根目录原只读资产。

Scene 之后要保留新的 `stage_inputs_snapshot/coordinate_manifest.json`；A2 从新 Scene 的 world-up 开始，新重建不能复用旧 A2缓存。A3 使用新 A2 autogen，保持 fixed-object 语义和1000步，最终再导出消费参考。

当前隔离 stage helper 的命令预览示例（只预览，不启动）：

```bash
R=项目根目录
C="$R/candidates/<新候选名>"
"$R/envs/geometry/bin/python" "$C/code/run_aligned_teacher_stage.py" \
  --root "$C" --task official_taco_development --stage scene \
  --gpus 1 --print-command
```

实际启动前只需核实写入 namespace、A1 pose输入和冻结参数。已有健康任务保持运行。本次审查未创建远端新候选目录、未运行模型，也未修改任何共享阶段状态。

## 后续协调指令下的 CPU 隔离准备（本节更新前文准备状态）

协调者随后要求实际准备隔离 namespace，并明确保持原消费参考的 raw-depth baseline。本轮据此创建了远端 `$R/candidates/phase4_tracking_upstream`，入口为该目录 `code/run_phase4_stage.py`。**尚未安装 R2 A1 新输出，未启动 GPU。**

复用现有 workspace 复制器之后，立即将 `run_all.sh`、`scripts/refine_scene.sh`、`scripts/scene_alignment_refinement.py` 恢复为原根目录版本；三文件逐字节相等记录在 `inventory/CPU_CONTRACT.json`。Scene 采用原 `legacy` policy 和 `processed_data/depth_alignment/raw_depth`，240次预算与原权重不变。A3采用原 `run_paper_task_a3.sh`，沿用原 native prepass行为，1000次预算不变。新分支因此只改变 A1 tracking。

本地可重现准备脚本是本目录 `prepare_r2_namespace.py`。首次准备在把已经软链接的 adapter 复制为私有副本时出现 `SameFileError`，尚未执行模型；随后改为先移除新 namespace 中该软链接再复制，使用 `--resume-preparation` 完成已有准备，不重复创建。根目录 adapter未被此脚本修改。

已生成三任务各 Scene/A2/A3 共9条命令预览，`CPU_CONTRACT.json` 状态为 `passed_CPU_only`；它验证了Scene仍为 legacy/raw-depth/240步，并记录全部实际命令。另远端现有128组 adapter坐标契约测试通过，最大误差 (9.99\times10^{-16}\)，invalid候选过滤通过。Mac的系统Python缺scipy，坐标测试改用已有远端geometry环境执行；未新增环境。

接续示例（由主协调者选择何时执行）：

```bash
R=项目根目录
C="$R/candidates/phase4_tracking_upstream"
# 先将R2四对象tracking/ob_in_cam的完整结果复制到对应新Data目录；brush若重跑则同理。
# 原根目录全部输出保留；新namespace的workspace记录仍标A1_install_pending。
"$R/envs/geometry/bin/python" "$C/code/run_phase4_stage.py" \
  --root "$C" --task official_taco_development --stage scene --gpus 1
"$R/envs/geometry/bin/python" "$C/code/run_phase4_stage.py" \
  --root "$C" --task official_taco_development --stage a2 --gpus 1,2
"$R/envs/geometry/bin/python" "$C/code/run_phase4_stage.py" \
  --root "$C" --task official_taco_development --stage a3 --gpus 1,2
```

各阶段可加 `--print-command` 只输出命令；这些预览已完成。Scene输出及snapshot位于新Data的 `hand_object_registration/scene_alignment/`；A2 publication为新 `results/<tag>_handoff/a2_publish.json`；A3 completion为新 `results/<tag>_handoff/a3_complete.json`。新local.env已指向私有adapter副本。A1是独立matrix输出再安装，所以full stage不隐式触发adapter variant。

## 最终报告可复用的忠实度简表

下表基于既有 `sources/REPRODUCTION_SPEC.md`、`METHOD_CODE_MATRIX.md`、`claude_work/RESULTS_RL_20261025.md`、`RESULTS_RL_PHASE2_20261025.md`、`t2/T2_REPORT.md`、Phase2各报告与Phase3结果。日期较早的“尚未运行”表述由实际后续回执更新；这里列出最终已采用关系，不把准备状态当运行完成。

|阶段|论文明示且已执行的范围|未公开处的通用实现选择|确定偏离或结果范围|
|---|---|---|---|
|源码来源|按照论文v1组织全链与十项评价；采用固定commit `e1ebcc3a375a36d6a2ac4d4467008566f67e1205`|使用自称EgoMatrix的公开匿名候选源码|具名论文作者与该匿名仓库的关联待确认；不能简称“作者官方完整实现”。其13依赖原标pending，生产adapter缺失，运行适配由本工程补齐|
|A1基础模型/尺度/相机|真实SAM3.1、MoGe-3、SAM3D、HaWoR；一次手尺度对齐后，aligned-depth DROID和world-space replay已执行|SAM3D首帧/seed42、完整自然语言prompt、空mask后类别词简化、实例绑定来自RGB；完整checkpoint版本与运行参数记录|仅三任务pipeline pilot，精确论文示例ID未知；brush/cut使用事先定义的eligible任务片段，报告按manifest范围，不能声称复现51段原实验|
|A1物体tracking|FP首有效帧注册、相机传播+SpatialTracker刚体候选、refine/score、严重遮挡只改平移/保留传播|缺失runner由bootstrap adapter补；5/2来自官方FP；.5/.5/32和可见性渲染门槛为自补阈值；Phase4 prev-camera为显式额外候选|当前实现与公开论文有共同核心，精确私有production tracking策略未知；Phase4分支结果须与baseline分列，不能说修正了已证实的参数bug|
|Scene源视图对齐|固定右手、优化左手及两物体平移；独立渲染可见性/轮廓/边界/覆盖、相对深度排序；实际240步|源码损失权重、patch16/sample64等；桌面plane估计和grounding细节|**确定输入偏离：论文A.1相对深度明确取aligned MoGe-3，最终C3的Scene却消费未尺度对齐的raw-depth/legacy teacher，task0-0/1/2均如此。** aligned_teacher_v1已修正teacher并完整跑通task0-4/5/6作为独立对照；它未替换最终C3。Phase4新namespace为隔离A1继续保留此已知偏离|
|A2多起点/时序|35个ray offset扫描→5起点，粗SE(3) bound，common-unary二阶DP，世界时序与非接触/swept，实际完整运行|公开源码的学习率、窗口、sweep与选择权重沿冻结baseline|物体朝向修正bound12°，直接限制对A1大漂移的修复能力；不能把超范围误差全归RL。候选源码还带任务质量发布/局部安全恢复，最终按实际receipt披露|
|A3接触对应/手优化|ray+normal对应、分段/DBSCAN/medoid、语义补点、每手1000步腕/关节优化|官方ContactPrompt103part映射到简化区域；TIP∪PAD作功能池；RGB预定义grasp类别；精确语义表未公开|公开候选的 `side` fallback为noop。**逐任务实际：main249与brush209两prepass均disabled，native与paper-fixed-objects初始化全序列物体/MANO数组恒等，本项符合固定对象边界。cut200的touch prepass实际enabled，整段调整左板及绑定左手，右刀保持；object-collision disabled。** cut这项实际行为偏离论文固定对象A3与非接触grounding边界。aligned_teacher采用paper-fixed-objects；对照须用main/brush原等价结果及cut独立fixed结果|
|T2 retarget|原腕/关节/指尖、关节限位、时序、桌面目标项保留；最终真实loader验收|首帧3000/其他300；forward后reverse完整求解；按每手整条原目标总分选方向；table upsample repair1200|双向求解和预算不由论文唯一指定，属通用数值分支。12手均选reverse；最初严格逐手中位不增未全过，后续简报接受全帧硬门槛通过。不能把原生300单向称为最终配置|
|B接触retarget|保留T2关键点/时序/桌面项；以预测MANO/重建mesh定义接触|额外接触权重5、MANO表面距离≤5mm激活、指腹目标内压3mm、每link64采样；三任务统一；额外table repair最多1200并保留Adam状态|这是论文未给的新增目标项，须标“授权的通用接触改进”。最终C3使用B输出，已不再是单纯原式(6)求解；不能将效果全部归给论文原方法|
|RL原框架与数值移植|双手直接PPO、disable-imitator、自由物体PhysX执行；完整state/action/wrench记录和frame0评价|stable_contact_v1关自碰撞、depenetration1m/s；v2 Kp500/Kd30取ManipTrans，effort0.4/1.1Nm沿资产；腕前馈PD400/40/20/1|reference-base前馈加PPO残差由简报授权，论文无唯一控制配方；IsaacSim5.1/Lab2.3.2移植与IsaacGym上游非逐分量等价。gain“上游一致”不等于全部物理设置一致|
|最终C3控制/训练|原reward公式及权重、质量/摩擦沿用；持续指数课程按上游修正；GT-free冻结后独立GT评分|B参考、v2、distal link2取力、object_filtered范围、残差1、动作滑动平均0.2、额外对象阈值×4并在96000控制步回到1；256env前600→1024接续|额外课程/残差/平滑属于通用控制分支；末指节body与上游一致，但最终过滤本物体力与上游全碰撞净力不同。阶段二均best900/latest1200，选型按物理/参考误差；参考所有采样都相同参数，GT未用于选型|
|完整rollout评价|对双对象共同固定尺度SE(3)对齐、每对象首帧canonical旋转偏置、全程<0.10m且<1rad|`evaluation_full_sequence=True`保留内部failure并延迟reset，统一额外倍率1、关闭训练课程|完整497/399/417步代表真实全覆盖；原内部首失败仍为30/26/90。训练RSI成功率与论文任务成功分开。阶段二最终整体0/3，主例/cut真抬起，brush未持续持物|
|SVOR/联合合成|真实SVOR去人/手臂/物体，联合机器人+物体重放、前景/无前景双render、阴影transmittance和线性合成；主例249帧实际视频|候选仓库未给完整B模块，新增记录/重放/paired renderer；SVOR20步、guidance6、720p、81帧窗/overlap9与最远窗口中心拼接|SVOR长视频工程适配有接缝与首窗圆环伪影，背景质量失败证据仍在；主例视频沿用此背景。完整合成是失败rollout的可视化，不能当论文成功示例；未完成独立目标背景迁移的最终实证|

阶段二最终0/3、Phase3参考双对象通过1/3与逐对象错误等数字直接复用既有独立评分。本轮没有为这张忠实度表新增实验、重算指标或修改历史参考。

### 遮挡证据类别补充

协调者核查保存的实际参数后指出，原 `occluder_mask_dir` 同时包含左右手 mask 与另一物体 mask。adapter将列表按位union，因此其 severe 条件覆盖“手或物体遮挡”；论文原文明示的是 severe hand occlusion。这个实现扩大了文本说明的触发证据范围，精确作者私有策略仍未知。

独立 `hand-only` 解释分支有原文依据：只让明确语义绑定的左右手mask进入 severe遮挡比例，覆盖率、.5/.5阈值、32像素与传播规则保持原值。应使用专用手mask参数或明确列表传入，避免靠路径字符串猜类别。该分支与已经冻结的 `upstream-augmented` 候选分开，冻结和选择依据记录为论文文本及GT-free遮挡记录；最终GT继续独立评分。

## 逐任务更正与已存证据补充（2026-10-26）

本轮补读 `inventory/PAPER_FIXED_OBJECTS_OLD3_REUSE.json` 与已存cut轨迹归因，修正上表此前将“native代码含prepass功能”概括到所有最终样本的表述。实际执行范围如下：

|样本|touch prepass|object-collision prepass|实际结论|
|---|---|---|---|
|main249|disabled|disabled|native与paper-fixed-objects的全序列物体/MANO初始化数组均等于原输入，可以复用原结果；本项符合固定对象边界|
|brush209|disabled|disabled|同main，两策略初始化恒等；本项符合固定对象边界|
|历史brush260|disabled|disabled|同一复用回执亦证实恒等；该260帧样本不属于最终三任务的brush209|
|cut200|enabled，仅target0板|disabled|板根平移平均16.15 mm、最大34.12 mm；旋转平均0.04873 rad、最大0.09473 rad，绑定LH随之刚体变换；刀仅数值精度差。本项实际偏离论文固定对象A3|

cut证据为 `results/appendix_c/paper_taco_cut_eligible_validation_A3_object_trajectory_attribution.json`，scope明确是既存完整200帧数组与native预处理审计，无重算评分。cut的这项物体收益来自预处理；main/brush未执行这项预处理。

Scene输入偏离也已核准：`sources/paper.txt` 约5179–5211行明示，patch对的深度估计来自 **aligned MoGe-3 depth**。`inventory/SCENE_DEPTH_TEACHER_AUDIT_20261025.json` 记录最终原三任务的actual_scene_teacher均指向raw_depth，`continuous_gap_scale=null`，缓存patch数值与raw一致；A1/FP对象深度则已完成一次尺度对齐。这使Scene相对深度目标与米制几何的尺度来源不一致，属于确定输入偏离。main尺度0.850206、brush209尺度0.749869，对应raw相对aligned的差值尺度约为1.1762/1.3336。

`results/ALIGNED_TEACHER_THREE_FULL_CHAIN_SUMMARY_20261025.md` 与 `ALIGNED_TEACHER_SCENE_SUMMARY_20261025.md` 已明确将teacher改为一次aligned深度，保留其余预算/权重后完整执行三段Scene→A2→固定物体A3→参考→API，结果变化混合。最终阶段二C3继续使用旧task0-0/1/2链，故最终报告应同时写清“已知输入偏离”和“独立修正对照已完成、未替换C3结果”。本次只核对已存证据并修正文档，无新实验。
