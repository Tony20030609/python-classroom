"""Local prompt preview for the browser classroom, not an LLM client.

This is an independently written compatibility module. The course's original
online helper was not supplied. No network request or model inference occurs.
"""


def print_llm_response(prompt):
    """Display the final prompt honestly, without generating a model answer."""
    if not isinstance(prompt, str):
        raise TypeError("提示词必须是字符串。")
    print("【离线提示词预览 · 未调用大模型】")
    print(prompt)
    print("\n以上是将发送给 AI 的提示词；实际答复需要复制到联网的 AI 服务中生成。")
