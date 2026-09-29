:-dynamic fo/2.
:-dynamic fi/2.
:-dynamic cf/2.
:-dynamic change/0.
:-dynamic m/3.
:-dynamic tm/1.
:-dynamic ebnf/2.  % EBNF grammar productions (written as LHS ==> RHS in the grammar file)
:-dynamic bnf/2.   % BNF grammar productions (compiled from the EBNF productions)
:-op(550,xfy,===>).  % Rewrite rules on EBNF expressions
:-op(500,xfy,==>).   % EBNF grammar productions
:-op(500,xfy,=>).    % BNF grammar productions (only used when printing)
:-op(490,xfy,or).
:-op(480,fy,*).
:-op(470,xfy,\).

% Since SWI-Prolog 8.3, ==> and => are built-in (SSU) rule operators, so
% grammar clauses written as `LHS ==> RHS.` would be compiled as rules
% instead of stored as facts. Capture them as ebnf/2 facts instead.
term_expansion((LHS ==> RHS), ebnf(LHS,RHS)).


:-reconsult('rewrite.pl').
:-reconsult('ll1.pl').
:-reconsult('prune').
:-reconsult('output_to_javascript.pl').

go:-
	ebnf_to_bnf,
	prune_for_top_symbol,
	ll1_tables,
	ll1_check,
	output_file(Out),
	write('Writing to '),write(Out),nl,
	tell(Out),
	output_table_js,
	output_keywords_js,
	output_punct_js,
	js_vars(Vars),
	output_vars_js(Vars),
	told.
