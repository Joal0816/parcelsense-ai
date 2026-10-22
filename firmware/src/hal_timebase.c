/* TIM6 internal update interrupt provides HAL's millisecond clock.
 * No GPIO, oscillator crystal, UART, or sensor bus mapping is assumed. */
#include "stm32f4xx_hal.h"
#include "stm32f4xx_ll_bus.h"
#include "stm32f4xx_ll_tim.h"

HAL_StatusTypeDef HAL_InitTick(uint32_t priority)
{
    if (priority >= (1UL << __NVIC_PRIO_BITS)) {
        return HAL_ERROR;
    }
    LL_APB1_GRP1_EnableClock(LL_APB1_GRP1_PERIPH_TIM6);
    LL_TIM_DisableCounter(TIM6);
    LL_TIM_DisableIT_UPDATE(TIM6);
    uint32_t timer_clock = HAL_RCC_GetPCLK1Freq();
    if ((RCC->CFGR & RCC_CFGR_PPRE1) != 0U) {
        timer_clock *= 2U;
    }
    if (timer_clock < 1000000U || timer_clock % 1000000U != 0U) {
        return HAL_ERROR;
    }
    LL_TIM_SetPrescaler(TIM6, timer_clock / 1000000U - 1U);
    LL_TIM_SetAutoReload(TIM6, 999U);
    LL_TIM_SetCounter(TIM6, 0U);
    LL_TIM_GenerateEvent_UPDATE(TIM6);
    LL_TIM_ClearFlag_UPDATE(TIM6);
    HAL_NVIC_ClearPendingIRQ(TIM6_DAC_IRQn);
    HAL_NVIC_SetPriority(TIM6_DAC_IRQn, priority, 0U);
    HAL_NVIC_EnableIRQ(TIM6_DAC_IRQn);
    uwTickPrio = priority;
    LL_TIM_EnableIT_UPDATE(TIM6);
    LL_TIM_EnableCounter(TIM6);
    return HAL_OK;
}

void HAL_SuspendTick(void) { LL_TIM_DisableIT_UPDATE(TIM6); }
void HAL_ResumeTick(void) { LL_TIM_EnableIT_UPDATE(TIM6); }

void TIM6_DAC_IRQHandler(void)
{
    if (LL_TIM_IsEnabledIT_UPDATE(TIM6) && LL_TIM_IsActiveFlag_UPDATE(TIM6)) {
        LL_TIM_ClearFlag_UPDATE(TIM6);
        HAL_IncTick();
    }
}
