"""WS-001: render a stream-json Claude Code transcript as a readable tool-call log (raw .jsonl stays the record)."""
import json, sys
print(f"# Summary of {sys.argv[1]}\n")
for line in open(sys.argv[1], encoding='utf-8'):
    d = json.loads(line)
    t = d.get('type')
    if t == 'system' and d.get('subtype') == 'init':
        print(f"- init: model={d.get('model')} permissionMode={d.get('permissionMode')} cwd={d.get('cwd')}")
        print(f"- init: mcp_servers={json.dumps(d.get('mcp_servers'))}")
        print(f"- init: tools={', '.join(d.get('tools', []))}\n")
    elif t in ('assistant', 'user'):
        content = d['message']['content']
        for c in content if isinstance(content, list) else []:
            if c.get('type') == 'tool_use':
                print(f"**TOOL CALL** `{c['name']}` {json.dumps(c['input'], ensure_ascii=False)}\n")
            elif c.get('type') == 'tool_result':
                body = c.get('content')
                if isinstance(body, list):
                    body = '\n'.join(x.get('text', '') for x in body if isinstance(x, dict))
                print(f"**TOOL RESULT** is_error={c.get('is_error')}\n```\n{str(body)[:3000]}\n```\n")
            elif c.get('type') == 'text' and t == 'assistant':
                print(f"**ASSISTANT** {c['text']}\n")
    elif t == 'result':
        print(f"- result: subtype={d.get('subtype')} is_error={d.get('is_error')} num_turns={d.get('num_turns')}")
        print(f"- permission_denials: {json.dumps(d.get('permission_denials'), ensure_ascii=False)}")
