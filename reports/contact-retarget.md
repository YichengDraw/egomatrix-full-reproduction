# P2B 接触感知 retarget

方法类别：**论文未说明的通用选择**。论文原关键点、腕方向、局部形状、时序和桌面 clearance 项全部保留，在原损失加接触点的世界坐标距离项。默认接触权重为 0，沿用旧行为。

## 证据与几何

P1 在 task0-0 中发现：右中指 MANO 接触帧表面距离中位约 1.92 mm，FK tip 原点约 8.71 mm；右小指约 1.00→9.23 mm；左中指约 1.16→4.02 mm。MANO 重建的接触合理，支持补充机器人接触约束。FK tip 原点与指腹碰撞表面是不同作用点。

本分支使用 source adapter 中已映射的 MANO 指尖表面顶点（食353、中467、无名576、小695、拇766）。逐帧在重建物体的真实三角网格上找最近表面，仅当该 MANO 顶点距离表面 ≤5 mm 时激活该指。source.object_trajectory 与 source.object_mesh_path 按原 loader 契约匹配；task0-0 的 root→canonical 变换为单位阵。

对应的机器人点取该指 tip 的父末指节实体表面：对 T2 native 基线姿态，选择距离 MANO 最近物体表面投影点最近的确定性 URDF collision sample，固定为该帧的 link-local 点。使用末指节指腹的广面几何，同时保留原 tip 关键点。P1 PhysX 记录确认主要手物接触发生在这些 link2；tiny tip 本身也有真实碰撞。

目标为 MANO 最近表面点沿外法线向内 3 mm。统一接触权重 5、激活距离 5 mm、内压 3 mm、64 个碰撞表面点/link。所有任务相同常数。物体网格有非封闭边，3 mm 法线目标的实际最近表面深度会受边缘影响；右手梯度验证中实际目标深度中位 2.78 mm，全部激活目标在网格符号距离内侧。

## 开关与运行

- `retarget.py --contact-weight 5 --contact-source-distance .005 --contact-target-penetration .003 --contact-reference-pkl <native_t2.pkl>`。
- contact_reference 只定义对应指腹点；原 `--reverse-pass-from` 复用 T2 选定 native reverse 的最后姿态作为反向顺序优化初值。每帧 300 次、首帧 3000、原 table upsample repair 1200。
- 新输出树：远端 `claude_work/phase2/p2b/retarget_contact_v1/`。旧 T2 树保留。
- `run_contact.sh` 完成双手 retarget 后自动通过真实 RL loader 导出 actual_reference，并复用全帧硬门槛审计。
- 本分支未读取独立 GT；GT 由最终评分阶段使用。

## 验证与当前状态

- Python 编译通过。
- 实际 source、native T2 基线和新接触目标的梯度 smoke 通过：首个激活帧接触误差 5.58 mm，关节梯度范数 0.0245，梯度全部有限。
- 右手 native 激活指帧数：拇157、食52、中40、无名11、小8；任一指激活178/249帧。
- CPU 双手全序列、上采样与 actual loader 导出于 2026-10-25 13:26:50 UTC 完成；controller PID 3827482，启动 13:17:51 UTC。墙钟约 539 秒。

真实几何与运行验收保存于 `contact_surface_audit.json`、`audit_contact_v1.json`。双手均为497帧，全部有限，原 table 最终校验通过。LH 所有帧满足原终止阈值×0.7，最差比0.699；RH有4帧略超该0.7门槛，最差比1.021（约40.84 mm相对40 mm），全部仍低于RL原始指尖终止门槛。主流程继续测试B物理及训练，不额外按帧修补。

`contact_surface_curves.png` 已生成并实际查看：橙线为T2固定指腹对应点，蓝线为B，灰线为表面内压目标；只显示对应MANO实际接触的帧。右拇/中指多数接触帧由表面外约2 mm移入约2.8 mm；左拇/食/中指也移至内侧。右无名指少数早帧仍有约6 mm外距，右拇末尾少数帧约7 mm外距，曲线保留这些残差。左小指无MANO近表面接触，未强加接触项。

| 手 | 指 | 激活native帧 | T2指腹有符号距离中位mm | B指腹有符号距离中位mm |
|---|---|---:|---:|---:|

| rh | thumb | 157 | 2.296 | -2.786 |
| rh | index | 52 | 0.373 | -2.212 |
| rh | middle | 40 | 2.284 | -2.790 |
| rh | ring | 11 | 1.892 | -1.913 |
| rh | pinky | 8 | 2.445 | -2.075 |
| lh | thumb | 44 | 3.348 | -1.135 |
| lh | index | 33 | 0.637 | -0.548 |
| lh | middle | 33 | 1.379 | -0.795 |
| lh | ring | 8 | -0.590 | -1.390 |

有符号距离负值表示内侧；这里的作用点是固定指腹表面对应点。

实际RL参考指尖误差中位：
- rh：T2 5.751 mm → B 6.318 mm；MANO输入最大差 0 m。
- lh：T2 1.710 mm → B 2.426 mm；MANO输入最大差 0 m。

B 的零残差物体跟随和 PPO 由主训练流程验收。扩展入口已准备：`bash run_contact.sh TACO_task0-1 TACO_task0-2`；主例触发 P3 后才启动，常数沿用本表配置。
