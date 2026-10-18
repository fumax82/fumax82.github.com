ý
8
ProvaSchermatecom.ric.navigatoregiroDelleSchermateæ
¿java.lang.AssertionError: Failed to inject touch input.
Reason: Expected exactly '1' node but could not find any node that satisfies: (Text + InputText + EditableText contains 'Passa da' (ignoreCase: false))

	at androidx.compose.ui.test.SemanticsNodeInteraction.fetchOneOrThrow(SemanticsNodeInteraction.kt:178)
	at androidx.compose.ui.test.SemanticsNodeInteraction.fetchOneOrThrow$default(SemanticsNodeInteraction.kt:150)
	at androidx.compose.ui.test.SemanticsNodeInteraction.fetchSemanticsNode(SemanticsNodeInteraction.kt:84)
	at androidx.compose.ui.test.ActionsKt.performTouchInput(Actions.kt:403)
	at androidx.compose.ui.test.AndroidActions.performClickImpl(Actions.android.kt:23)
	at androidx.compose.ui.test.ActionsKt.performClick(Actions.kt:61)
	at com.ric.navigatore.ProvaSchermate.giroDelleSchermate(ProvaSchermate.kt:86)
java.lang.RuntimeException…java.lang.RuntimeException: java.lang.AssertionError: Failed to inject touch input.
Reason: Expected exactly '1' node but could not find any node that satisfies: (Text + InputText + EditableText contains 'Passa da' (ignoreCase: false))

	at androidx.compose.ui.test.SemanticsNodeInteraction.fetchOneOrThrow(SemanticsNodeInteraction.kt:178)
	at androidx.compose.ui.test.SemanticsNodeInteraction.fetchOneOrThrow$default(SemanticsNodeInteraction.kt:150)
	at androidx.compose.ui.test.SemanticsNodeInteraction.fetchSemanticsNode(SemanticsNodeInteraction.kt:84)
	at androidx.compose.ui.test.ActionsKt.performTouchInput(Actions.kt:403)
	at androidx.compose.ui.test.AndroidActions.performClickImpl(Actions.android.kt:23)
	at androidx.compose.ui.test.ActionsKt.performClick(Actions.kt:61)
	at com.ric.navigatore.ProvaSchermate.giroDelleSchermate(ProvaSchermate.kt:86)

	at com.android.tools.androidtest.testengine.descriptor.AndroidDynamicTestDescriptor.execute(AndroidDynamicTestDescriptor.kt:68)
	at com.android.tools.androidtest.testengine.descriptor.AndroidDynamicTestDescriptor.execute(AndroidDynamicTestDescriptor.kt:36)
	at java.base/java.util.concurrent.ForkJoinTask.doExec(ForkJoinTask.java:387)
	at java.base/java.util.concurrent.ForkJoinPool$WorkQueue.topLevelExec(ForkJoinPool.java:1312)
	at java.base/java.util.concurrent.ForkJoinPool.scan(ForkJoinPool.java:1843)
	at java.base/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1808)
	at java.base/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:188)
"Õ

logcatandroid¿
¼/home/runner/work/fumax82.github.com/fumax82.github.com/app/build/outputs/androidTest-results/connected/debug/test(AVD) - 14/logcat-com.ric.navigatore.ProvaSchermate-giroDelleSchermate.txt*©

device-infoandroidŽ
‹/home/runner/work/fumax82.github.com/fumax82.github.com/app/build/outputs/androidTest-results/connected/debug/test(AVD) - 14/device-info.pb