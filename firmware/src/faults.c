#include "stm32f4xx_hal.h"
#include "FreeRTOS.h"
#include "task.h"

/* Debugger-visible fault breadcrumb. No UART or allocation in fault paths. */
const char * volatile g_fault_file;
volatile unsigned g_fault_line;

__attribute__((noreturn)) void foundation_assert_failed(const char *file, unsigned line)
{
    __disable_irq();
    g_fault_file = file;
    g_fault_line = line;
    for (;;) { __WFI(); }
}

void vApplicationMallocFailedHook(void)
{
    foundation_assert_failed("FreeRTOS allocation", 0U);
}

void vApplicationStackOverflowHook(TaskHandle_t task, char *name)
{
    (void)task;
    (void)name;
    foundation_assert_failed("FreeRTOS stack overflow", 0U);
}

void HardFault_Handler(void) { foundation_assert_failed("HardFault", 0U); }
void MemManage_Handler(void) { foundation_assert_failed("MemManage", 0U); }
void BusFault_Handler(void) { foundation_assert_failed("BusFault", 0U); }
void UsageFault_Handler(void) { foundation_assert_failed("UsageFault", 0U); }
void vApplicationIdleHook(void) { __WFI(); }
