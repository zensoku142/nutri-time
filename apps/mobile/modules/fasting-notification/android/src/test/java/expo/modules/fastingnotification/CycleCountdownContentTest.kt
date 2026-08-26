// ==================== 通知栏倒计时文案测试 ====================

package expo.modules.fastingnotification

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CycleCountdownContentTest {
  @Test
  fun fastingUsesFastingCopy() {
    assertEquals(
      CycleCountdownContent("断食进行中", "距离断食目标结束"),
      createCycleCountdownContent("fasting"),
    )
  }

  @Test
  fun eatingUsesEatingCopy() {
    assertEquals(
      CycleCountdownContent("进食窗口进行中", "距离进食窗口结束"),
      createCycleCountdownContent("eating"),
    )
  }

  @Test
  fun unknownStageIsRejected() {
    assertThrows(IllegalArgumentException::class.java) {
      createCycleCountdownContent("idle")
    }
  }
}
