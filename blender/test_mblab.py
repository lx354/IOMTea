"""
MB-Lab 完整脚本 Blender4.5
修复点：
1. 安全删物体，无select_all上下文报错
2. 自动匹配骨骼名称，无arm_R KeyError
3. 废弃bpy.ops.pose.armature_apply，改用底层API固化姿态
4. 关闭灯光解决4.5 use_contact_shadow报错
5. 自动删除多余白色编辑骨架
6. 自带生成宽松上衣并自动绑定骨骼
"""
import bpy
import math

# 1. 安全清空场景所有物体
for obj in bpy.data.objects:
    bpy.data.objects.remove(obj)

# 2. 启用MB-Lab插件
addon_name = 'MB-Lab'
if addon_name not in bpy.context.preferences.addons:
    bpy.ops.preferences.addon_enable(module=addon_name)

# 3. MB-Lab生成参数，关闭灯光防报错
scene = bpy.context.scene
scene.mblab_character_name = 'm_as01'
scene.mblab_use_ik = False
scene.mblab_use_muscle = False
scene.mblab_use_cycles = False
scene.mblab_use_eevee = True
scene.mblab_use_lamps = False

print("开始生成人体模型...")
bpy.ops.mbast.init_character()

# 获取初始骨架与人体网格
temp_armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)
body_mesh = next((obj for obj in bpy.data.objects if obj.type == "MESH" and len(obj.data.vertices) > 500), None)

if temp_armature and body_mesh:
    print(f"人体创建成功，顶点：{len(body_mesh.data.vertices)}")
    body_mesh["character_age"] = 0.85
    bpy.ops.mbast.finalize_character()
    print("角色固化完成")

    # 删除白色临时编辑骨架
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE" and "MBLab_Edit_Skeleton" in obj.name:
            bpy.data.objects.remove(obj)
    print("多余白色编辑骨架已删除")

    armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)
    if not armature:
        print("未找到动画骨骼，流程终止")
    else:
        # 进入姿态模式调整手臂
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode='POSE')
        pose_bones = armature.pose.bones

        # 自动匹配左右大臂、小臂骨骼
        bone_arm_r = bone_arm_l = bone_fore_r = bone_fore_l = None
        for bone in pose_bones:
            low_name = bone.name.lower()
            if "arm" in low_name and "r" in low_name and "fore" not in low_name:
                bone_arm_r = bone
            if "arm" in low_name and "l" in low_name and "fore" not in low_name:
                bone_arm_l = bone
            if "forearm" in low_name and "r" in low_name:
                bone_fore_r = bone
            if "forearm" in low_name and "l" in low_name:
                bone_fore_l = bone

        rotate_arm = math.radians(-85)
        rotate_fore = math.radians(10)
        if bone_arm_r:
            bone_arm_r.rotation_euler = (0, 0, rotate_arm)
        if bone_arm_l:
            bone_arm_l.rotation_euler = (0, 0, -rotate_arm)
        if bone_fore_r:
            bone_fore_r.rotation_euler = (0, rotate_fore, 0)
        if bone_fore_l:
            bone_fore_l.rotation_euler = (0, rotate_fore, 0)

        # ========== 替换报错的armature_apply，底层API固化姿态 ==========
        arm_data = armature.data
        for p_bone in pose_bones:
            # 把当前姿态矩阵写入骨骼基础变换
            arm_data.bones[p_bone.name].matrix = p_bone.matrix @ arm_data.bones[p_bone.name].matrix_local.inverted()
        # 清空姿态，姿态永久固化
        bpy.ops.pose.select_all(action='SELECT')
        bpy.ops.pose.transforms_clear()
        bpy.ops.object.mode_set(mode='OBJECT')
        print("手臂已永久固定为自然下垂姿态")

        # ====================== 自动生成宽松上衣 ======================
        bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1.1))
        cloth = bpy.context.active_object
        # 缩放适配人体躯干
        cloth.scale = (0.58, 0.32, 0.72)
        bpy.ops.object.transform_apply(scale=True, location=True)

        # 外扩做出宽松效果
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.transform.shrink_fatten(value=0.14)
        bpy.ops.object.mode_set(mode='OBJECT')

        # 细分平滑衣服
        sub_mod = cloth.modifiers.new(name="Subdivision", type='SUBSURF')
        sub_mod.levels = 2

        # 衣服自动绑定人物骨骼
        bpy.ops.object.select_all(action='DESELECT')
        cloth.select_set(True)
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        print("宽松上衣生成完毕并绑定骨骼")

else:
    print("人物生成失败，请检查MB-Lab插件是否正常安装启用")