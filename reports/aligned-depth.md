# Aligned teacher：三段完整链验收（2026-10-25）

三段Scene→A2→固定物体A3→实际loader参考→8env/seed0/1epoch API均已真实完成。独立GT评分覆盖249/200/209全帧及248/199/208相邻帧对。原RGB时钟、相机/K、物体绑定保持，各自实际F完整逆变换回同一common世界；canonical相同，形状与V-HACD缓存复用。

本轮修正Scene/A2 teacher为既成一次aligned MoGe，保留其余预算、权重和种子。A3对照的主基线为main/brush原固定物体结果，cut为paper-fixed-objects v1。GT仅评价；阶段和样本全部保留。

## A3单组件对照

每格为冻结基线→aligned teacher；距离mm、速度mm/s、角度rad，均越小越好。

|样本|RA|CD_h|ATE|ARE|RTE|腕物相对速度|绑定Dpen|绑定SD|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|主249|17.256→17.291|76.561→76.061|41.149→42.099|1.410→1.416|7.371→7.312|242.448→239.406|1.184→1.270|83.515→83.375|
|切割200|17.451→17.619|41.113→40.457|29.317→29.524|0.683→0.675|7.767→7.988|232.982→227.961|1.422→1.703|69.839→74.027|
|刷洗209|16.835→17.066|26.630→25.205|14.442→14.399|0.168→0.166|6.435→6.574|199.590→205.187|1.062→1.101|63.817→68.082|

结果呈混合变化：三段CD_h下降、RA均略增；腕物速度main/cut下降、brush上升；三段平均穿透均增，SD主片近同、cut/brush增加。该尺度修正与论文teacher定义对齐，当前结果仍存在动作/物体外观与执行差距。

## 新链完整阶段

|样本|阶段|CD_h mm|腕物相对速度mm/s|绑定Dpen mm|绑定SD mm|
|---|---|---:|---:|---:|---:|
|主249|A1|95.019|360.878|0.699|96.780|
|主249|Scene|85.525|376.025|0.981|92.736|
|主249|A2|75.733|308.037|0.374|98.836|
|主249|A3|76.061|239.406|1.270|83.375|
|切割200|A1|65.315|295.811|4.426|82.838|
|切割200|Scene|78.513|309.546|5.438|80.066|
|切割200|A2|39.900|262.018|0.213|92.060|
|切割200|A3|40.457|227.961|1.703|74.027|
|刷洗209|A1|40.587|393.941|1.551|83.299|
|刷洗209|Scene|29.783|402.059|1.424|77.824|
|刷洗209|A2|26.200|276.739|0.435|83.053|
|刷洗209|A3|25.205|205.187|1.101|68.082|

## 原核审计的范围与实际几何

|样本|适用边旧→新／交集|失败旧→新|新N/A边|新全片bound最深mm|新最深端点mm|
|---|---|---:|---:|---:|---:|
|主249|164→165 / 164|1→0|331|-8.613（N/A）|-8.454（N/A）|
|切割200|11→11 / 11|2→4|387|-11.513（N/A）|-7.801（N/A）|
|刷洗209|170→170 / 170|0→1|246|-9.819（N/A）|-8.997（N/A）|

main新增LH18→19，其余164边交集；RH11→12旧signed/limit−7.066992/−6.864665→新−7.003498/−7.756602mm。距离浅.063493mm，A2起始接触包络使limit放宽.891937mm，原判定因两项变化转为通过。

cut同11条适用边，失败新集合RH188→189、189→190、191→192、197→198，均非绑定board（signed−1.102333/−.474598/−1.669517/−.272775mm，limit0）。与旧失败集合交集188→189；旧独有195→196，新独有189→190、191→192、197→198。188→189绑定knife从−7.884845/limit−7.108131变为−4.914669/limit−6.047401mm通过，非绑定board转为失败。

brush同170条适用边，新增LH147→148 contact_to_task失败：旧−4.634568/limit−5.067492→新−5.791547/limit−4.666306mm。该边几何更深1.156979mm，同时limit收紧.401187mm。新原适用最深bound为RH8→9，−6.943678/limit−7.439858mm，通过；新非绑定全片最小+21.104116mm，N/A。三个端点原可追溯165/11/170条全部通过，其他333/389/248条N/A。contact-contact保留原规则适用范围，所有边仍保存真实几何。

审计均原规则、无GT或优化：main87.746s/638MiB、cut47.825s/590MiB、brush70.666s/632MiB；GPU0短任务已释放。

## 完整消费参考与9步API

完整60Hz参考497/399/417保留，精确even索引回原249/200/209时刻；各自真实F/L/E与source/K/c2w验证通过。smoothed778缺native MANO FK关节，RA/CD_h/官方腕物相对速度N/A。以下为完整参考原时钟评分：

|样本|ATE mm旧→新|RTE mm旧→新|Dpen mm旧→新|SD mm旧→新|
|---|---:|---:|---:|---:|
|主249|40.551→41.553|3.906→3.851|1.435→1.443|82.379→84.173|
|切割200|28.928→29.072|3.579→3.543|1.422→1.664|71.569→75.826|
|刷洗209|13.542→13.509|3.510→3.622|1.187→1.162|65.491→68.079|

三个新API均9post/18pre、0.15s、第9步失败，实际参考9/497、9/399、9/417，独立GT只5/249、5/200、5/209覆盖。main失败拇/食/中/环；cut另有物体位置/旋转；brush为食/中。下表复用各自实际reference和同9步；FK（机器人正向运动学）→MANO表示retarget固有差，sim→FK表示执行差。

|样本/侧|FK→MANO mm旧→新|sim→FK mm旧→新|
|---|---:|---:|
|主249 lh|31.721→31.583|67.676→89.700|
|主249 rh|32.241→32.180|72.487→82.453|
|切割200 lh|32.441→32.137|59.943→60.134|
|切割200 rh|34.939→36.395|49.193→65.896|
|刷洗209 lh|27.415→27.333|47.506→48.314|
|刷洗209 rh|32.038→31.962|36.281→35.783|

腕平移/腕旋转影响/腕局部指形向量的各自范数、闭合与guard检查保存在JSON，reward当前参考与固定lookahead分列。三张共同9步曲线均已在Mac实际查看；brush两版曲线接近，main双手与cut右手执行差更大。

- 完整三段JSON与原始分数入口（来源：`results/appendix_c/aligned_teacher_v1_A3_API_three_summary.json`）
- main曲线（来源：`results/rl_TACO_task0-4/comparison_to_frozen_baseline/common_first9_curves.png`）
- cut曲线（来源：`results/rl_TACO_task0-5/comparison_to_frozen_baseline/common_first9_curves.png`）
- brush曲线（来源：`results/rl_TACO_task0-6/comparison_to_frozen_baseline/common_first9_curves.png`）
- main/cut关键边详细表（来源：`results/ALIGNED_TEACHER_A3_API_MAIN_CUT_SUMMARY_20261025.md`）
- main完整五列RGB对照（来源：`results/frontdepth_overlay/official_taco_development/aligned_teacher_v1_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）
- cut完整五列RGB对照（来源：`results/frontdepth_overlay/paper_taco_cut_eligible_validation/aligned_teacher_v1_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）
- brush完整五列RGB对照（来源：`results/frontdepth_overlay/paper_taco_brush_eligible_development/aligned_teacher_v1_A2_A3_comparison/rgb_frontdepth_comparison_5frames.jpg`）

原RGB全片新旧A2/A3、实际参考、API普通视频已由RL owner全249/200/209解码并逐图查看，五帧sheet本地齐。本worker也逐一查看三张五时刻全列sheet：main末两时刻勺斜跨碗而源RGB竖置右侧；cut末帧预测双手位置/指形和源RGB差距明显；brush中帧刷体外廓、指形偏差仍在，新旧列整体接近。主formal按原预算继续；下一权重18对照仅备妥配置与评价路径，待root决定。

