"""Compile only the CubeF4-bundled kernel, GCC M4F port, and heap_4.

Registers sources and include paths before PlatformIO constructs the application.
Framework CPU/FPU flags subsequently apply to these same source nodes. No download, SDK source mutation, CMSIS-RTOS, or second startup.
"""
from pathlib import Path

Import("env")  # noqa: F821 -- provided by SCons

framework = Path(env.PioPlatform().get_package_dir("framework-stm32cubef4"))
kernel = framework / "Middlewares/Third_Party/FreeRTOS/Source"
if not (kernel / "portable/GCC/ARM_CM4F/port.c").is_file():
    raise RuntimeError("Installed CubeF4 package lacks the required GCC ARM_CM4F port")
# PlatformIO build_flags applies FPU options to compilation; repeat for linking
# so GCC selects the matching hard-float multilib, and for startup assembly.
env.Append(LINKFLAGS=["-mfpu=fpv4-sp-d16", "-mfloat-abi=hard"],
           ASFLAGS=["-mfpu=fpv4-sp-d16", "-mfloat-abi=hard"])
env.Append(CPPPATH=[str(kernel / "include"), str(kernel / "portable/GCC/ARM_CM4F")])
env.BuildSources(
    "$BUILD_DIR/FreeRTOS", str(kernel),
    src_filter="-<*> +<tasks.c> +<queue.c> +<list.c> "
               "+<portable/GCC/ARM_CM4F/port.c> +<portable/MemMang/heap_4.c>",
)
