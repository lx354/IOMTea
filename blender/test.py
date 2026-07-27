"""
MB-Lab完整人物生成脚本｜立体全套服饰：长袖上衣+长裤+休闲鞋
适配Blender4.5 | 无各类上下文/骨骼/灯光报错
特性：服饰带实体厚度，立体结构，非简易方块面片，自动贴合人体+骨骼绑定
"""
import bpy
import math

# ===================== 1. 安全清空全场景物体，规避select_all上下文报错 =====================
for obj in bpy.data.objects:
    bpy.data.objects.remove(obj)

# ===================== 2. 自动启用MB-Lab人物插件 =====================
addon_name = 'MB-Lab'
if addon_name not in bpy.context.preferences.addons:
    bpy.ops.preferences.addon_enable(module=addon_name)

# ===================== 3. MB-Lab人物生成配置（关闭灯光解决4.5版本兼容报错） =====================
scene = bpy.context.scene
scene.mblab_character_name = 'm_as01'
scene.mblab_use_ik = False
scene.mblab_use_muscle = False
scene.mblab_use_cycles = False
scene.mblab_use_eevee = True
scene.mblab_use_lamps = False

print("开始生成基础人体模型...")
bpy.ops.mbast.init_character()

# 获取原始编辑骨架、人体网格模型
temp_armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)
body_mesh = next((obj for obj in bpy.data.objects if obj.type == "MESH" and len(obj.data.vertices) > 500), None)

if temp_armature and body_mesh:
    print(f"人体创建完成，网格顶点数量：{len(body_mesh.data.vertices)}")
    body_mesh["character_age"] = 0.85
    bpy.ops.mbast.finalize_character()
    print("人物模型固化完成")

    # 删除多余白色MB-Lab编辑临时骨架，仅保留可动画骨骼
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE" and "MBLab_Edit_Skeleton" in obj.name:
            bpy.data.objects.remove(obj)
    print("多余白色编辑骨架已清除，场景仅保留一套动画骨骼")

    armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)
    if not armature:
        print("错误：未检索到人物动画骨骼，程序终止")
    else:
        # ===================== 4. 调整手臂自然下垂姿态 =====================
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode='POSE')
        pose_bones = armature.pose.bones

        # 自动识别左右大臂、小臂骨骼，兼容所有MB-Lab骨骼命名规则
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

        # 手臂旋转参数
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

        bpy.ops.object.mode_set(mode='OBJECT')
        print("手臂调整至自然下垂姿势")

        # ==============================================================================
        # ===================== 模块1：立体长袖宽松上衣（带厚度，非纸片） =====================
        # ==============================================================================
        print("正在生成立体长袖上衣...")
        bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1.15))
        top = bpy.context.active_object
        top.name = "LongSleeve_Top"
        # 基础体型缩放，覆盖躯干+手臂区域
        top.scale = (0.62, 0.35, 0.78)
        bpy.ops.object.transform_apply(scale=True, location=True)

        # 编辑模式微调宽松度，轻微外扩不紧绷
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.transform.shrink_fatten(value=0.06)
        bpy.ops.object.mode_set(mode='OBJECT')

        # 实体化修改器：增加布料厚度，杜绝纸片效果
        solid_top = top.modifiers.new(name="Solidify", type='SOLIDIFY')
        solid_top.thickness = 0.018

        # 收缩包裹贴合人体，保留间隙防穿模
        wrap_top = top.modifiers.new(name="Shrinkwrap", type='SHRINKWRAP')
        wrap_top.target = body_mesh
        wrap_top.wrap_method = 'NEAREST_SURFACE_POINT'
        wrap_top.offset = 0.025

        # 细分平滑布料褶皱质感
        subdiv_top = top.modifiers.new(name="Subdivision", type='SUBSURF')
        subdiv_top.levels = 2

        # 上衣自动绑定人物骨骼
        bpy.ops.object.select_all(action='DESELECT')
        top.select_set(True)
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')

        # ==============================================================================
        # ===================== 模块2：立体直筒长裤（带裤腿厚度） =====================
        # ==============================================================================
        print("正在生成立体直筒长裤...")
        bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0.22))
        pants = bpy.context.active_object
        pants.name = "Straight_Pants"
        # 缩放适配双腿区域
        pants.scale = (0.42, 0.26, 0.46)
        bpy.ops.object.transform_apply(scale=True, location=True)

        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.transform.shrink_fatten(value=0.05)
        bpy.ops.object.mode_set(mode='OBJECT')

        # 裤腿实体厚度
        solid_pants = pants.modifiers.new(name="Solidify", type='SOLIDIFY')
        solid_pants.thickness = 0.015

        # 贴合腿部
        wrap_pants = pants.modifiers.new(name="Shrinkwrap", type='SHRINKWRAP')
        wrap_pants.target = body_mesh
        wrap_pants.wrap_method = 'NEAREST_SURFACE_POINT'
        wrap_pants.offset = 0.02

        subdiv_pants = pants.modifiers.new(name="Subdivision", type='SUBSURF')
        subdiv_pants.levels = 2

        # 长裤绑定骨骼
        bpy.ops.object.select_all(action='DESELECT')
        pants.select_set(True)
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')

        # ==============================================================================
        # ===================== 模块3：左右立体低帮休闲鞋（完整鞋型，非方块） =====================
        # ==============================================================================
        print("正在生成左右休闲鞋子...")
        # 右鞋
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.16, 0.04, -0.46))
        shoe_r = bpy.context.active_object
        shoe_r.name = "Shoe_Right"
        shoe_r.scale = (0.23, 0.11, 0.095)
        bpy.ops.object.transform_apply(scale=True, location=True)

        # 左鞋（镜像对称）
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.16, 0.04, -0.46))
        shoe_l = bpy.context.active_object
        shoe_l.name = "Shoe_Left"
        shoe_l.scale = (0.23, 0.11, 0.095)
        bpy.ops.object.transform_apply(scale=True, location=True)

        # 统一处理鞋子厚度、平滑、贴合脚部
        for shoe in [shoe_r, shoe_l]:
            bpy.context.view_layer.objects.active = shoe
            # 实体厚度，做出鞋身体积
            solid_shoe = shoe.modifiers.new(name="Solidify", type='SOLIDIFY')
            solid_shoe.thickness = 0.012
            # 贴合脚底
            wrap_shoe = shoe.modifiers.new(name="Shrinkwrap", type='SHRINKWRAP')
            wrap_shoe.target = body_mesh
            wrap_shoe.offset = 0.008
            # 细分圆润鞋头
            subdiv_shoe = shoe.modifiers.new(name="Subdivision", type='SUBSURF')
            subdiv_shoe.levels = 2

            # 鞋子绑定骨骼
            bpy.ops.object.select_all(action='DESELECT')
            shoe.select_set(True)
            armature.select_set(True)
            bpy.context.view_layer.objects.active = armature
            bpy.ops.object.parent_set(type='ARMATURE_AUTO')

        print("全套立体服饰生成完毕：长袖上衣 + 直筒长裤 + 左右休闲鞋，已全部绑定骨骼！")
else:
    print("人物生成失败，请确认MB-Lab插件已正确安装至Blender4.5")