import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders agent answers (which often contain Markdown tables) safely — no raw HTML. */
export function Markdown({ children }: { children: string }) {
    return (
        <div className="prose-answer text-300 leading-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
        </div>
    );
}
